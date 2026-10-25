import os, httpx
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("WebSearch")

@mcp.tool()
async def web_search(query: str, max_results: int = 5) -> dict:
    """Search public web using Tavily; returns result titles, snippets, and URLs."""
    query = query.strip()
    if not query or len(query) > 500:
        raise ValueError("Query must be 1-500 characters")
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return {"error": "TAVILY_API_KEY is not configured", "results": []}
    payload = {"api_key": key, "query": query,
               "max_results": max(1, min(int(max_results), 8)),
               "search_depth": "basic", "include_answer": False}
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post("https://api.tavily.com/search", json=payload)
        response.raise_for_status()
        data = response.json()
    return {"query": query, "results": [
        {"title": x.get("title", ""), "url": x.get("url", ""),
         "content": x.get("content", ""), "score": x.get("score")}
        for x in data.get("results", [])]}

if __name__ == "__main__":
    mcp.run(transport="stdio")
