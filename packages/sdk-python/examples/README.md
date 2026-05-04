# Support Agent Example

A customer support agent powered by Claude that uses Tollgate to gate risky actions.

## Prerequisites

- Tollgate API running locally (`uvicorn tollgate.main:app --reload --port 8000` from `apps/api/`)
- Docker running (Postgres + Redis via `docker-compose up -d` from repo root)
- Slack workspace connected (see `apps/api/README.md` → Slack setup)
- ngrok tunnel active (`ngrok http 8000`)

## Step 1: Create an agent

```bash
# Sign up and get a JWT
JWT=$(curl -s -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo-pw-123","org_name":"Demo Org"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create the agent
curl -s -X POST http://localhost:8000/agents \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"support-agent-demo"}'
# Save the api_key from the response — you won't see it again
```

## Step 2: Upload the sample policy

```bash
AGENT_ID="<your-agent-id>"
POLICY=$(cat sample_policy.yaml)

curl -s -X POST "http://localhost:8000/agents/$AGENT_ID/policies" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"source_yaml\": $(python3 -c "import sys,json; print(json.dumps(open('sample_policy.yaml').read()))")}"
```

The policy allows refunds ≤ $100 automatically, requires Slack approval for refunds > $100, denies `delete_account`, and allows everything else.

## Step 3: Set environment variables

```bash
export TOLLGATE_API_KEY="tg_live_..."   # from Step 1
export TOLLGATE_BASE_URL="http://localhost:8000"
export ANTHROPIC_API_KEY="sk-ant-..."  # your Anthropic API key
```

## Step 4: Run the agent

```bash
pip install -r requirements.txt
python support_agent.py
```

## Step 5: Try it

Ask the agent to perform actions:

```
You: Issue a $50 refund for customer c_001
```
→ Allowed immediately (under $100 threshold)

```
You: Issue a $500 refund for customer c_002
```
→ Pauses and posts to your Slack `#approvals` channel. Check Slack, click Approve or Reject.

```
You: Delete account for customer c_003
```
→ Denied immediately by policy.
