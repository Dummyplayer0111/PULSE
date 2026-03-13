from channels.generic.websocket import AsyncWebsocketConsumer
import json


class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add('dashboard', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('dashboard', self.channel_name)

    async def receive(self, text_data):
        pass  # client → server messages not needed

    # Called by channel_layer.group_send(type='atm_update')
    async def atm_update(self, event):
        await self.send(text_data=json.dumps(event['data']))

    # Called by channel_layer.group_send(type='pipeline_event')
    async def pipeline_event(self, event):
        await self.send(text_data=json.dumps(event['data']))


class LogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.atm_id = self.scope['url_route']['kwargs']['atm_id']
        await self.channel_layer.group_add(f'logs_{self.atm_id}', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(f'logs_{self.atm_id}', self.channel_name)

    async def receive(self, text_data):
        pass

    async def log_entry(self, event):
        await self.send(text_data=json.dumps(event['data']))


class CustomerConsumer(AsyncWebsocketConsumer):
    """
    WebSocket for real-time customer transaction status updates.
    Group: customer_{phone_hash}
    Pushes: transaction_update events when FailedTransaction status changes.
    """

    async def connect(self):
        self.phone_hash = self.scope['url_route']['kwargs']['phone_hash']
        self.group_name = f'customer_{self.phone_hash}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass  # read-only for customers

    async def transaction_update(self, event):
        await self.send(text_data=json.dumps(event['data']))
