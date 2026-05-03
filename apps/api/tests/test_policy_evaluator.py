"""Tests for the policy evaluator module."""

import pytest

from tollgate.services.policy_evaluator import evaluate


class TestEvaluateBasic:
    """Basic evaluation tests."""

    def test_empty_policy_returns_deny(self) -> None:
        """Empty policy should return deny."""
        result = evaluate({}, "any_action", {})
        assert result.decision == "deny"
        assert result.reason == "no policy configured"
        assert result.approvers == []

    def test_no_matching_rule_uses_default_deny(self) -> None:
        """No matching rule should use default (deny)."""
        policy = {
            "version": 1,
            "rules": [{"action": "other_action", "decide": "allow"}],
            "default": "deny",
        }
        result = evaluate(policy, "test_action", {})
        assert result.decision == "deny"
        assert "no matching rule" in result.reason

    def test_no_matching_rule_uses_default_allow(self) -> None:
        """No matching rule should use explicit default allow."""
        policy = {
            "version": 1,
            "rules": [],
            "default": "allow",
        }
        result = evaluate(policy, "test_action", {})
        assert result.decision == "allow"

    def test_simple_allow_rule(self) -> None:
        """Simple allow rule should match."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test_action", "decide": "allow", "reason": "allowed by rule"}
            ],
        }
        result = evaluate(policy, "test_action", {})
        assert result.decision == "allow"
        assert result.reason == "allowed by rule"

    def test_simple_deny_rule(self) -> None:
        """Simple deny rule should match."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "delete_account", "decide": "deny", "reason": "never allowed"}
            ],
        }
        result = evaluate(policy, "delete_account", {})
        assert result.decision == "deny"
        assert result.reason == "never allowed"

    def test_require_approval_rule(self) -> None:
        """Require approval rule should return correct approvers."""
        policy = {
            "version": 1,
            "rules": [
                {
                    "action": "issue_refund",
                    "decide": "require_approval",
                    "approvers": ["#support-leads", "#managers"],
                }
            ],
        }
        result = evaluate(policy, "issue_refund", {})
        assert result.decision == "require_approval"
        assert result.approvers == ["#support-leads", "#managers"]

    def test_first_matching_rule_wins(self) -> None:
        """First matching rule should win."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test_action", "decide": "allow", "reason": "first rule"},
                {"action": "test_action", "decide": "deny", "reason": "second rule"},
            ],
        }
        result = evaluate(policy, "test_action", {})
        assert result.decision == "allow"
        assert result.reason == "first rule"


class TestOperatorEq:
    """Tests for eq operator."""

    def test_eq_string_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"eq": "active"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "active"})
        assert result.decision == "allow"

    def test_eq_string_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"eq": "active"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "inactive"})
        assert result.decision == "deny"

    def test_eq_number_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"count": {"eq": 5}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"count": 5})
        assert result.decision == "allow"


class TestOperatorNeq:
    """Tests for neq operator."""

    def test_neq_string_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"neq": "deleted"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "active"})
        assert result.decision == "allow"

    def test_neq_string_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"neq": "deleted"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "deleted"})
        assert result.decision == "deny"


class TestOperatorComparison:
    """Tests for comparison operators (gt, gte, lt, lte)."""

    def test_gt_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 100}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 150})
        assert result.decision == "allow"

    def test_gt_no_match_equal(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 100}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 100})
        assert result.decision == "deny"

    def test_gte_match_equal(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gte": 100}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 100})
        assert result.decision == "allow"

    def test_lt_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"lt": 50}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 30})
        assert result.decision == "allow"

    def test_lte_match_equal(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"lte": 50}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 50})
        assert result.decision == "allow"

    def test_combined_range(self) -> None:
        """Test gt and lte combined for range check."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 50, "lte": 500}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        # In range
        result = evaluate(policy, "test", {"amount": 200})
        assert result.decision == "allow"
        # Below range
        result = evaluate(policy, "test", {"amount": 50})
        assert result.decision == "deny"
        # Above range
        result = evaluate(policy, "test", {"amount": 501})
        assert result.decision == "deny"


class TestOperatorIn:
    """Tests for in operator."""

    def test_in_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"country": {"in": ["US", "CA", "UK"]}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"country": "US"})
        assert result.decision == "allow"

    def test_in_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"country": {"in": ["US", "CA", "UK"]}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"country": "DE"})
        assert result.decision == "deny"


class TestOperatorNotIn:
    """Tests for not_in operator."""

    def test_not_in_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"not_in": ["banned", "suspended"]}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "active"})
        assert result.decision == "allow"

    def test_not_in_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"status": {"not_in": ["banned", "suspended"]}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"status": "banned"})
        assert result.decision == "deny"


class TestOperatorContains:
    """Tests for contains operator."""

    def test_contains_string_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"email": {"contains": "@company.com"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"email": "user@company.com"})
        assert result.decision == "allow"

    def test_contains_string_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"email": {"contains": "@company.com"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"email": "user@other.com"})
        assert result.decision == "deny"

    def test_contains_list_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"tags": {"contains": "urgent"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"tags": ["important", "urgent", "review"]})
        assert result.decision == "allow"


class TestOperatorMatches:
    """Tests for matches (regex) operator."""

    def test_matches_simple(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"code": {"matches": r"^[A-Z]{3}\d{3}$"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"code": "ABC123"})
        assert result.decision == "allow"

    def test_matches_no_match(self) -> None:
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"code": {"matches": r"^[A-Z]{3}\d{3}$"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"code": "abc123"})
        assert result.decision == "deny"

    def test_matches_invalid_regex(self) -> None:
        """Invalid regex should fail safely."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"code": {"matches": r"[invalid("}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"code": "test"})
        assert result.decision == "deny"


class TestEdgeCases:
    """Edge case tests."""

    def test_missing_field_in_payload(self) -> None:
        """Missing field should not match conditions."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 0}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {})
        assert result.decision == "deny"

    def test_nested_field_access(self) -> None:
        """Nested field access with dot notation."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"user.role": {"eq": "admin"}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"user": {"role": "admin"}})
        assert result.decision == "allow"

    def test_type_mismatch_numeric_string(self) -> None:
        """String that looks like number should work with comparison."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 50}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": "100"})
        assert result.decision == "allow"

    def test_type_mismatch_non_numeric(self) -> None:
        """Non-numeric string should fail comparison safely."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"amount": {"gt": 50}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": "not-a-number"})
        assert result.decision == "deny"

    def test_null_value_with_eq(self) -> None:
        """Null/None value with eq operator."""
        policy = {
            "version": 1,
            "rules": [
                {"action": "test", "when": {"value": {"eq": None}}, "decide": "allow"}
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"value": None})
        assert result.decision == "allow"

    def test_multiple_conditions_all_match(self) -> None:
        """Multiple conditions should AND together."""
        policy = {
            "version": 1,
            "rules": [
                {
                    "action": "test",
                    "when": {
                        "amount": {"lte": 100},
                        "status": {"eq": "active"},
                    },
                    "decide": "allow",
                }
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 50, "status": "active"})
        assert result.decision == "allow"

    def test_multiple_conditions_partial_match(self) -> None:
        """Partial condition match should not pass (AND logic)."""
        policy = {
            "version": 1,
            "rules": [
                {
                    "action": "test",
                    "when": {
                        "amount": {"lte": 100},
                        "status": {"eq": "active"},
                    },
                    "decide": "allow",
                }
            ],
            "default": "deny",
        }
        result = evaluate(policy, "test", {"amount": 50, "status": "inactive"})
        assert result.decision == "deny"


class TestRealWorldPolicy:
    """Test with a real-world policy example."""

    def test_refund_policy(self) -> None:
        """Test the example refund policy from the requirements."""
        policy = {
            "version": 1,
            "rules": [
                {
                    "action": "issue_refund",
                    "when": {"amount": {"lte": 50}},
                    "decide": "allow",
                },
                {
                    "action": "issue_refund",
                    "when": {"amount": {"gt": 50, "lte": 500}},
                    "decide": "require_approval",
                    "approvers": ["#support-leads"],
                },
                {
                    "action": "delete_account",
                    "decide": "deny",
                    "reason": "Account deletion never allowed for agents",
                },
            ],
            "default": "deny",
        }

        # Small refund - allowed
        result = evaluate(policy, "issue_refund", {"amount": 30})
        assert result.decision == "allow"

        # Medium refund - requires approval
        result = evaluate(policy, "issue_refund", {"amount": 200})
        assert result.decision == "require_approval"
        assert result.approvers == ["#support-leads"]

        # Large refund - denied (no rule matches, default deny)
        result = evaluate(policy, "issue_refund", {"amount": 1000})
        assert result.decision == "deny"

        # Delete account - always denied
        result = evaluate(policy, "delete_account", {})
        assert result.decision == "deny"
        assert result.reason == "Account deletion never allowed for agents"

        # Unknown action - denied by default
        result = evaluate(policy, "unknown_action", {})
        assert result.decision == "deny"
