from mcp.server.fastmcp import FastMCP
from rag_store import search_knowledge
mcp = FastMCP("RAGKnowledge")

@mcp.tool()
def search_knowledge_base(query: str, top_k: int = 4) -> dict:
    """Search internal knowledge documents and return matching passages and sources."""
    return {"query": query, "results": search_knowledge(query, top_k)}

if __name__ == "__main__":
    mcp.run(transport="stdio")
