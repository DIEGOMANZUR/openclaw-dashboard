"""
OpenClaw Hybrid RAG Service
============================
FastAPI backend for hybrid RAG (Vector + BM25 + Graph)

Key Features:
- Hybrid search: Weaviate vectors + BM25 keyword search
- Graph RAG: Neo4j for entity extraction and relationships
- Incremental indexing with deduplication
- Configurable retention (infinite by default)
- Per-agent isolation with shared knowledge base
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import hashlib
import json
import os
from enum import Enum

# =============================================================================
# CONFIGURATION
# =============================================================================

class RetentionPolicy(str, Enum):
    INFINITE = "infinite"
    DAYS_10 = "10_days"
    DAYS_30 = "30_days"
    MONTHS_3 = "3_months"
    MONTHS_6 = "6_months"
    YEAR_1 = "1_year"

RETENTION_DAYS = {
    RetentionPolicy.INFINITE: None,
    RetentionPolicy.DAYS_10: 10,
    RetentionPolicy.DAYS_30: 30,
    RetentionPolicy.MONTHS_3: 90,
    RetentionPolicy.MONTHS_6: 180,
    RetentionPolicy.YEAR_1: 365,
}

class Config:
    # Weaviate
    WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8081")
    WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY", "")
    
    # Neo4j
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7688")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASS = os.getenv("NEO4J_PASS", "openclaw_password")
    
    # Embeddings
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSION = 1536
    
    # Chunking
    CHUNK_SIZE = 500  # tokens
    CHUNK_OVERLAP = 50  # tokens
    
    # Default retention
    DEFAULT_RETENTION = RetentionPolicy.INFINITE

# =============================================================================
# MODELS
# =============================================================================

class ChunkMetadata(BaseModel):
    """Metadata for each indexed chunk"""
    chunk_id: str
    content_hash: str
    agent_id: str
    source_type: str  # conversation, document, memory
    source_id: str
    timestamp: datetime
    retention_policy: RetentionPolicy = RetentionPolicy.INFINITE
    expires_at: Optional[datetime] = None

class DocumentChunk(BaseModel):
    """A chunk of text ready for indexing"""
    content: str
    metadata: ChunkMetadata
    embedding: Optional[List[float]] = None

class GraphNode(BaseModel):
    """An entity node for Neo4j"""
    node_id: str
    label: str  # Person, Concept, Document, Case, etc.
    name: str
    properties: Dict[str, Any] = {}
    agent_id: str
    timestamp: datetime

class GraphRelation(BaseModel):
    """A relationship between nodes"""
    source_id: str
    target_id: str
    relation_type: str  # MENTIONS, RELATES_TO, AUTHORED_BY, etc.
    properties: Dict[str, Any] = {}
    timestamp: datetime

class IndexRequest(BaseModel):
    """Request to index content"""
    content: str
    agent_id: str
    source_type: str = "conversation"
    source_id: str
    extract_entities: bool = True
    retention_policy: RetentionPolicy = RetentionPolicy.INFINITE

class SearchRequest(BaseModel):
    """Hybrid search request"""
    query: str
    agent_id: str
    include_shared: bool = True
    search_type: str = "hybrid"  # vector, bm25, hybrid, graph
    limit: int = 10
    min_score: float = 0.5

class SearchResult(BaseModel):
    """Search result with score"""
    content: str
    score: float
    source_type: str
    source_id: str
    agent_id: str
    timestamp: datetime
    search_method: str  # vector, bm25, graph

class RAGStats(BaseModel):
    """Statistics for a RAG collection"""
    collection_name: str
    object_count: int
    last_indexed: Optional[datetime]
    size_mb: float
    retention_policy: RetentionPolicy

class GraphStats(BaseModel):
    """Statistics for Neo4j graph"""
    total_nodes: int
    total_relationships: int
    nodes_by_label: Dict[str, int]
    last_updated: Optional[datetime]

# =============================================================================
# CHUNKING STRATEGY
# =============================================================================

class ChunkingStrategy:
    """
    Smart chunking for RAG indexing
    
    Strategy:
    1. Semantic chunking: Split at paragraph/sentence boundaries
    2. Overlap: 50 tokens overlap between chunks for context
    3. Metadata preservation: Keep source info in each chunk
    4. Deduplication: Hash-based detection of duplicate content
    """
    
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks"""
        # Simple word-based chunking (in production, use tiktoken)
        words = text.split()
        chunks = []
        
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk = " ".join(chunk_words)
            chunks.append(chunk)
            i += chunk_size - overlap
        
        return chunks
    
    @staticmethod
    def compute_hash(content: str) -> str:
        """Compute content hash for deduplication"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    @staticmethod
    def prepare_chunks(
        content: str,
        agent_id: str,
        source_type: str,
        source_id: str,
        retention_policy: RetentionPolicy
    ) -> List[DocumentChunk]:
        """Prepare content for indexing"""
        chunks = ChunkingStrategy.chunk_text(content)
        result = []
        
        for i, chunk_content in enumerate(chunks):
            content_hash = ChunkingStrategy.compute_hash(chunk_content)
            chunk_id = f"{agent_id}_{source_id}_{i}_{content_hash}"
            
            # Calculate expiration
            expires_at = None
            if retention_policy != RetentionPolicy.INFINITE:
                days = RETENTION_DAYS[retention_policy]
                expires_at = datetime.utcnow() + timedelta(days=days)
            
            metadata = ChunkMetadata(
                chunk_id=chunk_id,
                content_hash=content_hash,
                agent_id=agent_id,
                source_type=source_type,
                source_id=source_id,
                timestamp=datetime.utcnow(),
                retention_policy=retention_policy,
                expires_at=expires_at
            )
            
            result.append(DocumentChunk(content=chunk_content, metadata=metadata))
        
        return result

# =============================================================================
# ENTITY EXTRACTION (for Graph RAG)
# =============================================================================

class EntityExtractor:
    """
    Extract entities and relationships using LLM
    
    Extracts:
    - Persons: Names of people mentioned
    - Organizations: Companies, institutions
    - Concepts: Legal terms, technical concepts
    - Documents: Referenced documents, cases
    - Dates: Important dates and events
    """
    
    EXTRACTION_PROMPT = """Extract entities and relationships from this text.

Text: {text}

Return JSON with:
{{
  "entities": [
    {{"type": "Person|Organization|Concept|Document|Date", "name": "...", "properties": {{}}}}
  ],
  "relationships": [
    {{"source": "entity_name", "target": "entity_name", "type": "MENTIONS|RELATES_TO|AUTHORED_BY|OCCURRED_ON"}}
  ]
}}

Only extract clearly identifiable entities. Be conservative."""

    @staticmethod
    async def extract(text: str, agent_id: str) -> tuple[List[GraphNode], List[GraphRelation]]:
        """Extract entities and relationships from text"""
        # In production: Call LLM (Gemini/Claude) with EXTRACTION_PROMPT
        # For now, return empty lists (placeholder)
        
        nodes = []
        relations = []
        
        # TODO: Implement actual LLM extraction
        # response = await llm.generate(EXTRACTION_PROMPT.format(text=text))
        # parsed = json.loads(response)
        # ...
        
        return nodes, relations

# =============================================================================
# DEDUPLICATION STRATEGY
# =============================================================================

class DeduplicationStrategy:
    """
    Prevent redundancy between OpenClaw Memory and RAG
    
    Strategy:
    1. Content hashing: Skip already indexed content
    2. Semantic dedup: Merge similar chunks (cosine > 0.95)
    3. Memory vs RAG separation:
       - Memory: Current session context (ephemeral)
       - RAG: Long-term knowledge (persistent)
    4. Reference linking: Memory points to RAG chunks, not duplicates
    """
    
    indexed_hashes: set = set()
    
    @classmethod
    def is_duplicate(cls, content_hash: str) -> bool:
        """Check if content already indexed"""
        return content_hash in cls.indexed_hashes
    
    @classmethod
    def mark_indexed(cls, content_hash: str) -> None:
        """Mark content as indexed"""
        cls.indexed_hashes.add(content_hash)
    
    @staticmethod
    def should_index_to_rag(content: str, source_type: str) -> bool:
        """
        Determine if content should go to RAG vs Memory
        
        RAG (long-term):
        - Completed conversations
        - Uploaded documents
        - Important decisions/conclusions
        - Entity-rich content
        
        Memory only (session):
        - Ongoing conversation context
        - Temporary notes
        - System messages
        """
        # Always index completed conversations and documents
        if source_type in ["document", "conversation_complete"]:
            return True
        
        # Don't index system messages
        if source_type == "system":
            return False
        
        # Index if content is substantial (>100 chars)
        if len(content) > 100:
            return True
        
        return False

# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="OpenClaw RAG Service",
    description="Hybrid RAG with Vector + BM25 + Graph search",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for demo (replace with actual Weaviate/Neo4j)
indexed_chunks: Dict[str, DocumentChunk] = {}
graph_nodes: Dict[str, GraphNode] = {}
graph_relations: List[GraphRelation] = []
retention_settings: Dict[str, RetentionPolicy] = {}

# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "openclaw-rag", "version": "1.0.0"}

@app.post("/index")
async def index_content(request: IndexRequest, background_tasks: BackgroundTasks):
    """
    Index content to hybrid RAG
    
    Process:
    1. Check deduplication
    2. Chunk content
    3. Generate embeddings
    4. Store in Weaviate (vector + BM25)
    5. Extract entities → Neo4j
    """
    # Check if should index
    if not DeduplicationStrategy.should_index_to_rag(request.content, request.source_type):
        return {"status": "skipped", "reason": "content_type_excluded"}
    
    # Prepare chunks
    chunks = ChunkingStrategy.prepare_chunks(
        content=request.content,
        agent_id=request.agent_id,
        source_type=request.source_type,
        source_id=request.source_id,
        retention_policy=request.retention_policy
    )
    
    indexed_count = 0
    skipped_count = 0
    
    for chunk in chunks:
        # Check for duplicates
        if DeduplicationStrategy.is_duplicate(chunk.metadata.content_hash):
            skipped_count += 1
            continue
        
        # TODO: Generate embedding
        # chunk.embedding = await embedding_model.embed(chunk.content)
        
        # Store chunk (in production: Weaviate upsert)
        indexed_chunks[chunk.metadata.chunk_id] = chunk
        DeduplicationStrategy.mark_indexed(chunk.metadata.content_hash)
        indexed_count += 1
    
    # Extract entities in background
    if request.extract_entities:
        background_tasks.add_task(
            extract_and_store_entities,
            request.content,
            request.agent_id,
            request.source_id
        )
    
    return {
        "status": "success",
        "indexed": indexed_count,
        "skipped": skipped_count,
        "total_chunks": len(chunks)
    }

async def extract_and_store_entities(content: str, agent_id: str, source_id: str):
    """Background task: Extract entities and store in Neo4j"""
    nodes, relations = await EntityExtractor.extract(content, agent_id)
    
    for node in nodes:
        graph_nodes[node.node_id] = node
    
    graph_relations.extend(relations)

@app.post("/search", response_model=List[SearchResult])
async def hybrid_search(request: SearchRequest):
    """
    Hybrid search across RAG
    
    Search modes:
    - vector: Semantic similarity search
    - bm25: Keyword search
    - hybrid: Combined vector + BM25 (RRF fusion)
    - graph: Neo4j traversal for related entities
    """
    results = []
    
    # Filter by agent (include shared if requested)
    agent_filter = [request.agent_id]
    if request.include_shared:
        agent_filter.append("shared")
    
    # Simple search implementation (in production: Weaviate hybrid query)
    query_lower = request.query.lower()
    
    for chunk_id, chunk in indexed_chunks.items():
        if chunk.metadata.agent_id not in agent_filter:
            continue
        
        # Simple BM25-like scoring
        content_lower = chunk.content.lower()
        query_words = query_lower.split()
        matches = sum(1 for word in query_words if word in content_lower)
        
        if matches > 0:
            score = matches / len(query_words)
            if score >= request.min_score:
                results.append(SearchResult(
                    content=chunk.content,
                    score=score,
                    source_type=chunk.metadata.source_type,
                    source_id=chunk.metadata.source_id,
                    agent_id=chunk.metadata.agent_id,
                    timestamp=chunk.metadata.timestamp,
                    search_method="bm25"
                ))
    
    # Sort by score and limit
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:request.limit]

@app.get("/stats/weaviate")
async def get_weaviate_stats() -> List[RAGStats]:
    """Get Weaviate collection statistics"""
    # Group by agent
    stats_by_agent: Dict[str, RAGStats] = {}
    
    for chunk in indexed_chunks.values():
        agent = chunk.metadata.agent_id
        collection = f"OpenClaw_Agent_{agent}"
        
        if collection not in stats_by_agent:
            stats_by_agent[collection] = RAGStats(
                collection_name=collection,
                object_count=0,
                last_indexed=None,
                size_mb=0.0,
                retention_policy=chunk.metadata.retention_policy
            )
        
        stats_by_agent[collection].object_count += 1
        stats_by_agent[collection].size_mb += len(chunk.content) / 1024 / 1024
        
        if stats_by_agent[collection].last_indexed is None or \
           chunk.metadata.timestamp > stats_by_agent[collection].last_indexed:
            stats_by_agent[collection].last_indexed = chunk.metadata.timestamp
    
    return list(stats_by_agent.values())

@app.get("/stats/neo4j")
async def get_neo4j_stats() -> GraphStats:
    """Get Neo4j graph statistics"""
    nodes_by_label: Dict[str, int] = {}
    
    for node in graph_nodes.values():
        label = node.label
        nodes_by_label[label] = nodes_by_label.get(label, 0) + 1
    
    last_updated = None
    if graph_nodes:
        last_updated = max(n.timestamp for n in graph_nodes.values())
    
    return GraphStats(
        total_nodes=len(graph_nodes),
        total_relationships=len(graph_relations),
        nodes_by_label=nodes_by_label,
        last_updated=last_updated
    )

@app.put("/retention/{agent_id}")
async def set_retention_policy(agent_id: str, policy: RetentionPolicy):
    """Set retention policy for an agent's data"""
    retention_settings[agent_id] = policy
    
    # Update existing chunks
    updated = 0
    for chunk in indexed_chunks.values():
        if chunk.metadata.agent_id == agent_id:
            chunk.metadata.retention_policy = policy
            if policy != RetentionPolicy.INFINITE:
                days = RETENTION_DAYS[policy]
                chunk.metadata.expires_at = datetime.utcnow() + timedelta(days=days)
            else:
                chunk.metadata.expires_at = None
            updated += 1
    
    return {"status": "success", "policy": policy, "updated_chunks": updated}

@app.get("/retention/{agent_id}")
async def get_retention_policy(agent_id: str):
    """Get retention policy for an agent"""
    policy = retention_settings.get(agent_id, Config.DEFAULT_RETENTION)
    return {"agent_id": agent_id, "policy": policy}

@app.post("/cleanup")
async def cleanup_expired():
    """Remove expired chunks based on retention policy"""
    now = datetime.utcnow()
    removed = 0
    
    to_remove = []
    for chunk_id, chunk in indexed_chunks.items():
        if chunk.metadata.expires_at and chunk.metadata.expires_at < now:
            to_remove.append(chunk_id)
    
    for chunk_id in to_remove:
        del indexed_chunks[chunk_id]
        removed += 1
    
    return {"status": "success", "removed": removed}

@app.get("/collections")
async def list_collections():
    """List all RAG collections with details"""
    collections = {}
    
    for chunk in indexed_chunks.values():
        agent = chunk.metadata.agent_id
        if agent not in collections:
            collections[agent] = {
                "name": f"OpenClaw_Agent_{agent}",
                "chunks": 0,
                "last_indexed": None,
                "retention": chunk.metadata.retention_policy
            }
        
        collections[agent]["chunks"] += 1
        ts = chunk.metadata.timestamp.isoformat()
        if collections[agent]["last_indexed"] is None or ts > collections[agent]["last_indexed"]:
            collections[agent]["last_indexed"] = ts
    
    return list(collections.values())

# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
