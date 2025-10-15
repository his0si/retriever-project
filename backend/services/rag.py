from typing import List, Tuple
import structlog
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from qdrant_client import QdrantClient
import openai

from config import settings

logger = structlog.get_logger()


class RAGService:
    """RAG service for question answering"""
    
    def __init__(self):
        self.qdrant_client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key
        )
        
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            openai_api_key=settings.openai_api_key
        )
        
        self.embeddings_client = openai.OpenAI(api_key=settings.openai_api_key)
    
    async def get_answer(self, question: str) -> Tuple[str, List[str]]:
        """
        Get answer for a question using RAG
        Returns: (answer, sources)
        """
        try:
            # Get query embedding
            query_embedding = self._get_embedding(question)
            
            # Search similar documents
            search_results = self.qdrant_client.search(
                collection_name=settings.qdrant_collection_name,
                query_vector=query_embedding,
                limit=settings.top_k
            )
            
            if not search_results:
                return "죄송합니다. 관련된 정보를 찾을 수 없습니다.", []
            
            # Extract documents and sources
            documents = []
            sources = set()
            
            for result in search_results:
                documents.append(result.payload["text"])
                sources.add(result.payload["url"])
            
            # Build context
            context = "\n\n".join(documents)
            
            # Generate answer using GPT
            answer = await self._generate_answer(context, question)
            
            return answer, list(sources)
        
        except Exception as e:
            logger.error("Failed to get answer", question=question, error=str(e))
            raise
    
    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text"""
        response = self.embeddings_client.embeddings.create(
            model=settings.embedding_model,
            input=text
        )
        return response.data[0].embedding
    
    async def _generate_answer(self, context: str, question: str) -> str:
        """Generate answer using GPT"""
        messages = [
            SystemMessage(content="""당신은 학교 웹사이트 정보를 안내하는 Q&A 챗봇입니다. 
반드시 주어진 '컨텍스트' 내용만을 사용하여 사용자의 '질문'에 답변해야 합니다. 
컨텍스트에 없는 내용은 '정보를 찾을 수 없습니다.'라고 답변하세요. 
답변은 친절하고 명확하게 작성하되, 컨텍스트의 정보를 정확하게 전달하세요."""),
            HumanMessage(content=f"""[컨텍스트]
{context}

[질문]
{question}""")
        ]
        
        response = await self.llm.ainvoke(messages)
        return response.content