import os
from functools import lru_cache
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer

BASE = Path(__file__).resolve().parent
CHROMA_PATH = Path(os.getenv("CHROMA_PATH", str(BASE / "chroma_db")))
if not CHROMA_PATH.is_absolute():
    CHROMA_PATH = BASE / CHROMA_PATH

@lru_cache(maxsize=1)
def get_model():
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return client.get_or_create_collection(
        name="company_knowledge", metadata={"hnsw:space": "cosine"}
    )

def search_knowledge(query: str, top_k: int = 4) -> list[dict]:
    query = query.strip()
    if not query:
        raise ValueError("Query cannot be empty")
    top_k = max(1, min(int(top_k), 8))
    col = get_collection()
    if col.count() == 0:
        return []
    vector = get_model().encode(query, normalize_embeddings=True).tolist()
    result = col.query(
        query_embeddings=[vector], n_results=min(top_k, col.count()),
        include=["documents", "metadatas", "distances"]
    )
    return [
        {"text": doc, "source": result["metadatas"][0][i].get("source", "unknown"),
         "distance": float(result["distances"][0][i])}
        for i, doc in enumerate(result["documents"][0])
    ]
