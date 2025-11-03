#!/usr/bin/env python3
"""
Test search functionality to debug the issue
"""
import sys
sys.path.append('/home/his0si/retriever-project/backend')

from langchain_ollama import OllamaEmbeddings
from qdrant_client import QdrantClient
from config import settings

# Initialize clients
qdrant_client = QdrantClient(
    url=settings.qdrant_host,
    api_key=settings.qdrant_api_key
)

embeddings = OllamaEmbeddings(
    model=settings.ollama_embedding_model,
    base_url=settings.ollama_host
)

# Test query
query = "컴공 학생이 받을 수 있는 장학금"
print(f"Query: {query}\n")

# Get embedding
print("Getting embedding...")
query_embedding = embeddings.embed_query(query)
print(f"Embedding dimension: {len(query_embedding)}\n")

# Search with different score thresholds
for threshold in [0.3, 0.4, 0.5, 0.6]:
    print(f"\n{'='*60}")
    print(f"Searching with score_threshold={threshold}, limit=5")
    print('='*60)

    results = qdrant_client.search(
        collection_name=settings.qdrant_collection_name,
        query_vector=query_embedding,
        limit=5,
        score_threshold=threshold
    )

    print(f"Found {len(results)} results\n")

    for i, result in enumerate(results, 1):
        print(f"Result {i}:")
        print(f"  Score: {result.score:.4f}")
        print(f"  URL: {result.payload['url']}")
        print(f"  Text preview: {result.payload['text'][:150]}...")
        print()
