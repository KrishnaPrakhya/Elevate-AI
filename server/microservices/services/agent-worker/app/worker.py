import pika
import os
import json
import asyncio
import sys
from agent_functions import TASK_MAP

RABBITMQ_URL = os.getenv("RABBITMQ_URL")

def main():
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    queue_name = 'agent_tasks'
    channel.queue_declare(queue=queue_name, durable=True)
    print(' [*] Waiting for messages. To exit press CTRL+C')

    def callback(ch, method, properties, body):
        print(f" [x] Received message")
        message = json.loads(body)
        task_type = message.get("task_type")
        payload = message.get("payload")

        handler = TASK_MAP.get(task_type)
        if handler:
            try:
                # Run the async agent function
                result = asyncio.run(handler(payload))
                print(f" [✔] Task '{task_type}' completed. Result: {result[:100]}...")
                # In a real app, you would save this result to a database
                # or publish it to another queue for the user to retrieve.
            except Exception as e:
                print(f" [!] Task '{task_type}' failed: {e}")
        else:
            print(f" [?] No handler for task type '{task_type}'")

        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)