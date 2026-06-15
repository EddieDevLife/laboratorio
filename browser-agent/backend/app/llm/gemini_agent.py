"""
Gemini AI Integration for Browser Automation
Provides AI-powered browser automation through screenshot analysis and action planning.
"""

import logging
import uuid
import base64
from typing import Optional, Any
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from ..models.accessibility import PageSnapshot, AccessibilityNode
from ..models.actions import Action, ActionPlan, ActionTarget, ActionParams
from ..config import settings

logger = logging.getLogger(__name__)


class GeminiAgent:
    """
    Agent that uses Google Gemini to analyze browser state
    and generate action plans for task completion.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini Agent.
        
        Args:
            api_key: Google API key. If None, uses settings.google_api_key
        """
        self.api_key = api_key or settings.google_api_key
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not configured")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        
        # Use Gemini 2.0 Flash with vision capabilities
        self.model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-exp',
            safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )
        
        logger.info(f"GeminiAgent initialized with model: gemini-2.0-flash-exp")
    
    async def analyze_and_plan(
        self,
        task_objective: str,
        snapshot: PageSnapshot,
        screenshot_base64: Optional[str] = None,
        conversation_history: Optional[list] = None
    ) -> ActionPlan:
        """
        Analyze the current browser state and generate an action plan.
        
        Args:
            task_objective: The user's goal in natural language
            snapshot: Current page snapshot with accessibility tree
            screenshot_base64: Base64-encoded screenshot (optional but recommended)
            conversation_history: Previous messages for context (optional)
        
        Returns:
            ActionPlan with steps to accomplish the task
        """
        logger.info(f"Analyzing task: '{task_objective}' on {snapshot.url}")
        
        # Prepare context from accessibility tree
        tree_context = self._prepare_tree_context(snapshot.tree)
        
        # Build prompt
        prompt = self._build_prompt(task_objective, snapshot, tree_context)
        
        # Prepare content for Gemini
        content = [prompt]
        
        # Add screenshot if available
        if screenshot_base64:
            try:
                # Gemini expects image data without the data URL prefix
                image_data = screenshot_base64
                if ',' in image_data:
                    image_data = image_data.split(',', 1)[1]
                
                # Decode base64 to bytes
                image_bytes = base64.b64decode(image_data)
                
                # Add image to content
                content.append({
                    'mime_type': 'image/png',
                    'data': image_bytes
                })
                logger.debug("Screenshot added to Gemini request")
            except Exception as e:
                logger.warning(f"Failed to process screenshot: {e}")
        
        # Call Gemini
        try:
            response = self.model.generate_content(
                content,
                generation_config={
                    'temperature': 0.7,
                    'top_p': 0.95,
                    'top_k': 40,
                    'max_output_tokens': 2048,
                }
            )
            
            logger.info(f"Gemini response received")
            
            # Parse response into actions
            actions = self._parse_response(response, snapshot)
            
            # Create action plan
            plan = ActionPlan(
                planId=str(uuid.uuid4()),
                taskId=str(uuid.uuid4()),
                actions=actions,
                autonomyLevel="reactive",
                requiresConfirmation=True
            )
            
            logger.info(f"Generated plan with {len(actions)} action(s)")
            return plan
            
        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            raise
    
    def _prepare_tree_context(self, tree: AccessibilityNode, max_depth: int = 5) -> str:
        """
        Convert accessibility tree to readable text format.
        
        Args:
            tree: Root accessibility node
            max_depth: Maximum tree depth to traverse
        
        Returns:
            Formatted string representation of interactive elements
        """
        elements = []
        self._traverse_tree(tree, elements, depth=0, max_depth=max_depth)
        
        # Limit to most relevant elements
        return "\n".join(elements[:100])
    
    def _traverse_tree(
        self,
        node: AccessibilityNode,
        elements: list[str],
        depth: int = 0,
        max_depth: int = 5
    ):
        """Recursively traverse accessibility tree and collect interactive elements."""
        if depth > max_depth:
            return
        
        # Focus on interactive and visible elements
        interactive_roles = {
            'button', 'link', 'textbox', 'combobox', 'checkbox',
            'radio', 'menuitem', 'tab', 'searchbox', 'slider'
        }
        
        if node.visible and node.role in interactive_roles:
            indent = "  " * depth
            name = node.name or node.description or "(no label)"
            value = f" = '{node.value}'" if node.value else ""
            disabled = " [disabled]" if node.disabled else ""
            
            elements.append(
                f"{indent}- {node.role}: \"{name}\"{value}{disabled} "
                f"(id: {node.nodeId}, pos: {node.bounds.get('x', 0)},{node.bounds.get('y', 0)})"
            )
        
        # Traverse children
        for child in node.children:
            self._traverse_tree(child, elements, depth + 1, max_depth)
    
    def _build_prompt(
        self,
        task_objective: str,
        snapshot: PageSnapshot,
        tree_context: str
    ) -> str:
        """Build the prompt for Gemini."""
        return f"""You are a browser automation agent. Your task is to help accomplish the following objective:

**Task**: {task_objective}

**Current Page**:
- URL: {snapshot.url}
- Title: {snapshot.title}
- Viewport: {snapshot.viewportWidth}x{snapshot.viewportHeight}
- Scroll Position: ({snapshot.scrollX}, {snapshot.scrollY})

**Available Interactive Elements** (from accessibility tree):
{tree_context}

**Instructions**:
1. Analyze the screenshot (if provided) and accessibility tree
2. Determine the SINGLE NEXT action needed to accomplish the task
3. Return your response in this EXACT JSON format:

```json
{{
  "reasoning": "Brief explanation of why this action is needed",
  "action": {{
    "type": "click|type|press_key|scroll|navigate|wait|done",
    "target": {{
      "nodeId": "element_id_from_tree",
      "name": "element_name",
      "x": 100,
      "y": 200
    }},
    "params": {{
      "text": "text to type (for type action)",
      "key": "Enter|Tab|Escape (for press_key action)",
      "url": "https://... (for navigate action)",
      "direction": "up|down|left|right (for scroll action)",
      "amount": 500
    }},
    "confidence": 0.9
  }}
}}
```

**Action Types**:
- **click**: Click on an element (provide nodeId or x,y coordinates)
- **type**: Type text into an input field (provide nodeId and text)
- **press_key**: Press a keyboard key (provide key name)
- **scroll**: Scroll the page (provide direction and amount)
- **navigate**: Navigate to a URL (provide url)
- **wait**: Wait for a condition (provide ms)
- **done**: Task is complete

**Important**:
- Return ONLY ONE action (the next step)
- Use nodeId from the accessibility tree when possible
- Provide clear reasoning
- If task is complete, use "done" action
- Return valid JSON only, no additional text

Analyze and provide the next action:"""
    
    def _parse_response(
        self,
        response,
        snapshot: PageSnapshot
    ) -> list[Action]:
        """
        Parse Gemini's response and extract actions.
        
        Args:
            response: Gemini API response
            snapshot: Current page snapshot
        
        Returns:
            List of Action objects
        """
        actions = []
        
        try:
            # Get response text
            response_text = response.text
            logger.debug(f"Gemini response: {response_text[:500]}...")
            
            # Try to extract JSON from response
            import json
            import re
            
            # Find JSON block in response
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON without code blocks
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    logger.warning("No JSON found in response")
                    json_str = None
            
            if json_str:
                data = json.loads(json_str)
                
                # Extract action from parsed JSON
                action_data = data.get('action', {})
                reasoning = data.get('reasoning', 'No reasoning provided')
                
                action = Action(
                    actionId=str(uuid.uuid4()),
                    snapshotId=snapshot.snapshotId,
                    type=action_data.get('type', 'done'),
                    target=self._parse_target(action_data.get('target')),
                    params=self._parse_params(action_data.get('params')),
                    reasoning=reasoning,
                    confidence=action_data.get('confidence', 0.8)
                )
                
                actions.append(action)
                logger.info(f"Parsed action: {action.type} - {reasoning[:100]}")
            
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {e}")
        
        # If no actions generated, create a default "done" action
        if not actions:
            actions.append(Action(
                actionId=str(uuid.uuid4()),
                snapshotId=snapshot.snapshotId,
                type="done",
                reasoning="Unable to determine next step from AI response",
                confidence=0.5
            ))
        
        return actions
    
    def _parse_target(self, target_data: Optional[dict]) -> Optional[ActionTarget]:
        """Parse target data into ActionTarget object."""
        if not target_data:
            return None
        
        return ActionTarget(
            nodeId=target_data.get('nodeId'),
            role=target_data.get('role'),
            name=target_data.get('name'),
            index=target_data.get('index')
        )
    
    def _parse_params(self, params_data: Optional[dict]) -> Optional[ActionParams]:
        """Parse params data into ActionParams object."""
        if not params_data:
            return None
        
        return ActionParams(
            text=params_data.get('text'),
            key=params_data.get('key'),
            url=params_data.get('url'),
            deltaX=params_data.get('deltaX'),
            deltaY=params_data.get('deltaY'),
            ms=params_data.get('ms'),
            selector=params_data.get('selector')
        )
    
    def format_action_result(
        self,
        action: Action,
        success: bool,
        error: Optional[str] = None
    ) -> str:
        """
        Format action result for conversation history.
        
        Args:
            action: The executed action
            success: Whether action succeeded
            error: Error message if failed
        
        Returns:
            Formatted result string
        """
        status = "✓ Success" if success else "✗ Failed"
        result = f"{status}: {action.type}"
        
        if action.target and action.target.name:
            result += f" on '{action.target.name}'"
        
        if error:
            result += f" - Error: {error}"
        
        return result

# Made with Bob
