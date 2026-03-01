from django.core.management.base import BaseCommand
from django.db import models
from ATM.models import Incident, UserProfile


class Command(BaseCommand):
    help = 'Assign all OPEN/unassigned incidents to engineers (round-robin by load)'

    def handle(self, *args, **options):
        engineers = list(UserProfile.objects.filter(role='ENGINEER').select_related('user'))
        if not engineers:
            self.stdout.write(self.style.WARNING('No engineers found. Run seed_engineer first.'))
            return

        qs = list(Incident.objects.filter(status='OPEN').filter(
            models.Q(assignedTo__isnull=True) | models.Q(assignedTo='')
        ))
        if not qs:
            self.stdout.write('No OPEN unassigned incidents found.')
            return

        for i, incident in enumerate(qs):
            eng = engineers[i % len(engineers)]
            incident.assignedTo = eng.user.username
            incident.status = 'INVESTIGATING'

        Incident.objects.bulk_update(qs, ['assignedTo', 'status'])
        self.stdout.write(self.style.SUCCESS(f'Assigned {len(qs)} incidents to engineers.'))

        for eng in engineers:
            count = Incident.objects.filter(
                assignedTo=eng.user.username, status='INVESTIGATING'
            ).count()
            self.stdout.write(f'  {eng.user.username}: {count} investigating')
