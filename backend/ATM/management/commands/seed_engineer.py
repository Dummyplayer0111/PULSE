from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from ATM.models import UserProfile


class Command(BaseCommand):
    help = 'Create engineer1 user with ENGINEER role (password: pulse2026)'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username='engineer1',
            defaults={'email': 'engineer1@pulse.local', 'first_name': 'ATM', 'last_name': 'Engineer'},
        )
        if created:
            user.set_password('pulse2026')
            user.save()
            self.stdout.write(self.style.SUCCESS('Created user engineer1'))
        else:
            self.stdout.write('User engineer1 already exists')

        profile, pcreated = UserProfile.objects.get_or_create(
            user=user,
            defaults={'role': 'ENGINEER', 'fullName': 'Engineer'},
        )
        if not pcreated:
            profile.role = 'ENGINEER'
            profile.fullName = profile.fullName or 'Engineer'
            profile.save()

        self.stdout.write(self.style.SUCCESS(
            f'engineer1 ready — role={profile.role}, password=pulse2026'
        ))
