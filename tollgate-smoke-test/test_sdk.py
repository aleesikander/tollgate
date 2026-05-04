import os
from tollgate import Tollgate, ActionDenied

# Initialize the SDK with your local API
tg = Tollgate(
    api_key="tg_live_3bdccda9390439d587e7a198dbcb4de1",
    base_url="http://localhost:8000",
)

# This is what a real customer's agent code looks like
@tg.guard("issue_refund")
def issue_refund(amount: float, customer_id: str):
    """Pretend this actually calls Stripe to refund money."""
    print(f"   Refunding ${amount} to {customer_id}")
    return {"status": "refunded", "amount": amount, "customer_id": customer_id}


def main():
    print("\n=== TEST 1: Small refund ($30) - should auto-allow ===")
    try:
        result = issue_refund(amount=30, customer_id="cust_001")
        print(f"   PASS Got result: {result}")
    except ActionDenied as e:
        print(f"   FAIL Unexpectedly denied: {e}")

    print("\n=== TEST 2: Medium refund ($300) - should pause for Slack approval ===")
    print("   Waiting for approval in Slack... go click Approve!")
    try:
        result = issue_refund(amount=300, customer_id="cust_002")
        print(f"   PASS Got result after approval: {result}")
    except ActionDenied as e:
        print(f"   FAIL Denied/rejected: {e}")

    print("\n=== TEST 3: Large refund ($1500) - should be denied immediately ===")
    try:
        result = issue_refund(amount=1500, customer_id="cust_003")
        print(f"   FAIL Unexpectedly allowed: {result}")
    except ActionDenied as e:
        print(f"   PASS Correctly denied: {e}")

    print("\n=== Done ===\n")


if __name__ == "__main__":
    main()
