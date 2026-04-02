import pika
import os
import json

RABBITMQ_URL = os.getenv("RABBITMQ_URL")

def publish_task(task_type: str, payload: dict):
    """Publishes a task to the appropriate queue."""
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    queue_name = 'agent_tasks'
    channel.queue_declare(queue=queue_name, durable=True)

    message_body = {
        "task_type": task_type,
        "payload": payload
    }

    channel.basic_publish(
        exchange='',
        routing_key=queue_name,
        body=json.dumps(message_body),
        properties=pika.BasicProperties(
            delivery_mode=2,  # make message persistent
        ))
    print(f" [x] Sent '{task_type}' task to queue")
    connection.close()