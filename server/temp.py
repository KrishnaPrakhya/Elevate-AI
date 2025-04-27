from flask import Flask, request
from flask_socketio import SocketIO, join_room, emit
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from upstash_redis import Redis
import json
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import asyncio
import jwt
from functools import wraps
import os
from dotenv import load_dotenv
import uuid
app = Flask(__name__)
load_dotenv()
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default-secret-key")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

print(app.config["SECRET_KEY"])
# Database setup

engine = create_engine(os.getenv("DATABASE_URL"))
Base = declarative_base()
Session = sessionmaker(bind=engine)
session = Session()

# Define models
class User(Base):
    __tablename__ = "User"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerkUserId = Column(String, unique=True)
    email = Column(String, unique=True)
    name = Column(String, nullable=True)
    industry = Column(String, nullable=True)

class IndustryInsight(Base):
    __tablename__ = "IndustryInsight"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    industry = Column(String, unique=True)
    growthRate = Column(Float)
    demandLevel = Column(String)
    marketOutLook = Column(String)

class IndustryInsightHistory(Base):
    __tablename__ = "industry_insight_history"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    industry_insight_id = Column(String)
    growth_rate = Column(Float)
    demand_level = Column(String)
    updated_at = Column(DateTime, default=datetime.now)

redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN")
)

# JWT authentication decorator
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = args[0].get("token") if args and isinstance(args[0], dict) else None
        if not token:
            emit("error", {"message": "Authentication required"})
            return
        try:
            decoded = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            kwargs["user_id"] = decoded["user_id"]
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            emit("error", {"message": "Token has expired"})
            return
        except jwt.InvalidTokenError:
            emit("error", {"message": "Invalid token"})
            return
    return decorated

# Compute IndustryInsight changes (simplified)
def compute_insight_changes(industry):
    insight = session.query(IndustryInsight).filter_by(industry=industry).first()
    if not insight:
        return None
    history = session.query(IndustryInsightHistory).filter_by(industry_insight_id=insight.id).order_by(IndustryInsightHistory.updated_at.desc()).first()
    growth_rate_diff = insight.growth_rate - (history.growth_rate if history else 0) if history else insight.growth_rate
    changes = {
        "industry": industry,
        "growthRateDiff": growth_rate_diff,
        "demandLevel": insight.demand_level,
        "marketOutLook": insight.market_outlook,
        "message": f"Industry Update for {industry}: Growth rate {'increased' if growth_rate_diff > 0 else 'decreased'} by {abs(growth_rate_diff):.2f}%. Demand is {insight.demand_level}, outlook is {insight.market_outlook}."
    }
    redis_client.set(f"insight:{industry}", json.dumps(changes), ex=3600)
    session.add(IndustryInsightHistory(industry_insight_id=insight.id, growth_rate=insight.growth_rate, demand_level=insight.demand_level, market_outlook=insight.market_outlook))
    session.commit()
    return changes
# Scheduled task
def scheduled_insight_updates():
    insights = session.query(IndustryInsight).all()
    for insight in insights:
        changes = compute_insight_changes(insight.industry)
        if changes:
            socketio.emit("insight_update", changes, room=insight.industry)

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_insight_updates, "interval", minutes=60)
scheduler.start()

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    clerk_user_id = data.get("clerkUserId")
    if not clerk_user_id:
        return {"error": "clerkUserId required"}, 400
    user = session.query(User).filter_by(clerk_user_id=clerk_user_id).first()
    if not user:
        return {"error": "User not found"}, 404
    payload = {"user_id": user.id, "exp": datetime.utcnow() + timedelta(hours=1), "iat": datetime.utcnow()}
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithms=["HS256"])
    return {"token": token}

@app.route("/test_insights/<industry>")
def test_insights(industry):
    changes = compute_insight_changes(industry)
    if changes:
        socketio.emit("insight_update", changes, room=industry)
        return {"status": "success", "changes": changes}
    return {"status": "error", "message": "Industry not found"}, 404

@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("join_insights")
@require_auth
async def handle_join_insights(message, user_id):
    user = session.query(User).filter_by(id=user_id).first()
    if user and user.industry:
        join_room(user.industry)
        cached = redis_client.get(f"insight:{user.industry}")
        if cached:
            await socketio.emit("insight_update", json.loads(cached.decode()), to=user.industry)
        await socketio.emit("joined", {"industry": user.industry})
    else:
        await socketio.emit("error", {"message": "No industry specified"})

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)