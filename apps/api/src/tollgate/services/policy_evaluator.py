"""Policy evaluator - pure function for evaluating policies against actions."""

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class EvaluationResult:
    """Result of policy evaluation."""

    decision: str  # "allow", "deny", "require_approval"
    reason: str
    approvers: list[str]


def evaluate(policy_json: dict[str, Any], action_name: str, payload: dict[str, Any]) -> EvaluationResult:
    """Evaluate a policy against an action.

    Args:
        policy_json: Parsed policy JSON
        action_name: Name of the action being checked
        payload: Action payload with values to check

    Returns:
        EvaluationResult with decision, reason, and approvers list
    """
    if not policy_json:
        return EvaluationResult(
            decision="deny",
            reason="no policy configured",
            approvers=[],
        )

    rules = policy_json.get("rules", [])
    default = policy_json.get("default", "deny")

    # Evaluate rules in order - first match wins
    for rule in rules:
        rule_action = rule.get("action")

        # Check if this rule applies to the action
        if rule_action != action_name:
            continue

        # Check conditions in the "when" clause
        when_clause = rule.get("when", {})
        if _evaluate_conditions(when_clause, payload):
            decision = rule.get("decide", default)
            reason = rule.get("reason", f"matched rule for {action_name}")
            approvers = rule.get("approvers", [])

            return EvaluationResult(
                decision=decision,
                reason=reason,
                approvers=approvers,
            )

    # No matching rule found, use default
    return EvaluationResult(
        decision=default,
        reason=f"no matching rule for action '{action_name}'",
        approvers=[],
    )


def _evaluate_conditions(when_clause: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Evaluate all conditions in a when clause (AND logic).

    Args:
        when_clause: Dictionary of field -> condition mappings
        payload: Action payload values

    Returns:
        True if all conditions match, False otherwise
    """
    if not when_clause:
        return True

    for field, condition in when_clause.items():
        value = _get_nested_value(payload, field)

        if not _evaluate_condition(condition, value):
            return False

    return True


def _get_nested_value(data: dict[str, Any], field: str) -> Any:
    """Get a value from nested dict using dot notation.

    Args:
        data: Dictionary to extract from
        field: Field name, supports dot notation like "user.name"

    Returns:
        The value or None if not found
    """
    keys = field.split(".")
    result: Any = data

    for key in keys:
        if isinstance(result, dict):
            result = result.get(key)
        else:
            return None

    return result


def _evaluate_condition(condition: dict[str, Any] | Any, value: Any) -> bool:
    """Evaluate a single condition against a value.

    Args:
        condition: Condition dict with operators, or a direct value for equality
        value: The actual value from payload

    Returns:
        True if condition matches, False otherwise
    """
    # If condition is not a dict, treat as equality check
    if not isinstance(condition, dict):
        return bool(value == condition)

    # Evaluate each operator (all must match - AND logic within a condition)
    for operator, expected in condition.items():
        if not _apply_operator(operator, value, expected):
            return False

    return True


def _apply_operator(operator: str, actual: Any, expected: Any) -> bool:
    """Apply a single operator.

    Args:
        operator: The operator name (eq, neq, gt, etc.)
        actual: The actual value from payload
        expected: The expected value from policy

    Returns:
        True if the operator condition is satisfied
    """
    # Handle None/missing values
    if actual is None:
        # Only 'eq' with None or 'neq' with non-None should match
        if operator == "eq":
            return expected is None
        if operator == "neq":
            return expected is not None
        return False

    try:
        if operator == "eq":
            return bool(actual == expected)

        if operator == "neq":
            return bool(actual != expected)

        if operator == "gt":
            return _compare_numeric(actual, expected) > 0

        if operator == "gte":
            return _compare_numeric(actual, expected) >= 0

        if operator == "lt":
            return _compare_numeric(actual, expected) < 0

        if operator == "lte":
            return _compare_numeric(actual, expected) <= 0

        if operator == "in":
            if not isinstance(expected, list):
                return False
            return actual in expected

        if operator == "not_in":
            if not isinstance(expected, list):
                return True
            return actual not in expected

        if operator == "contains":
            if isinstance(actual, str):
                return expected in actual
            if isinstance(actual, list):
                return expected in actual
            return False

        if operator == "matches":
            if not isinstance(actual, str) or not isinstance(expected, str):
                return False
            try:
                return bool(re.search(expected, actual))
            except re.error:
                return False

        # Unknown operator - fail safe
        return False

    except (TypeError, ValueError):
        # Type mismatch or comparison error - fail safe
        return False


def _compare_numeric(actual: Any, expected: Any) -> int:
    """Compare two values numerically.

    Args:
        actual: The actual value
        expected: The expected value

    Returns:
        -1 if actual < expected, 0 if equal, 1 if actual > expected

    Raises:
        TypeError: If values cannot be compared numerically
    """
    # Convert to float for comparison
    actual_num = float(actual)
    expected_num = float(expected)

    if actual_num < expected_num:
        return -1
    if actual_num > expected_num:
        return 1
    return 0
