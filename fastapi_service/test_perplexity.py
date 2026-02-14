"""Quick test to verify Perplexity API connectivity."""
import os
import sys
os.environ.setdefault("PERPLEXITY_API_KEY", "pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

try:
    from openai import OpenAI
    print("[1/3] openai library loaded OK")
except ImportError:
    print("FAIL: openai library not installed")
    sys.exit(1)

try:
    client = OpenAI(
        api_key=os.environ["PERPLEXITY_API_KEY"],
        base_url="https://api.perplexity.ai"
    )
    print("[2/3] Perplexity client created OK")
except Exception as e:
    print(f"FAIL: Could not create client: {e}")
    sys.exit(1)

try:
    response = client.chat.completions.create(
        model="sonar-pro",
        messages=[{"role": "user", "content": "Say hello in one word only."}],
        max_tokens=10
    )
    content = response.choices[0].message.content.strip()
    print(f"[3/3] Perplexity API WORKING! Response: {content}")
    print("\n=== PERPLEXITY API TEST PASSED ===")
except Exception as e:
    print(f"FAIL: API call error: {e}")
    sys.exit(1)
