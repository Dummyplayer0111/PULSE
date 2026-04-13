"""
Demo helper — prints the language each ATM's customer SMS will be routed to.

Usage:
    python manage.py show_language_routing

Output:
    ┌────────────────────────────────────────────────────────────────────────┐
    │  Feature 11 — Multilingual Auto-Routing by ATM Region                  │
    ├──────┬──────────────────────┬────────────────┬──────────┬──────────────┤
    │  ID  │  Name                │  Location      │  Region  │  Language    │
    ├──────┼──────────────────────┼────────────────┼──────────┼──────────────┤
    │   1  │  SBI-Chennai-01      │  T. Nagar      │  Tamil…  │  ta  Tamil   │
    │  ...                                                                   │
    └──────┴──────────────────────┴────────────────┴──────────┴──────────────┘
    Distribution:  ta 12 (24%)  hi 10 (20%)  kn 8 (16%)  ...
"""
from collections import Counter

from django.core.management.base import BaseCommand

from ATM.models import ATM
from ATM.language_router import (
    LANGUAGE_META,
    SUPPORTED_LANGUAGES,
    detect_language,
)


def _trunc(text: str, width: int) -> str:
    text = (text or '').strip()
    return text if len(text) <= width else text[: width - 1] + '…'


class Command(BaseCommand):
    help = 'Print the detected customer-notification language for every ATM.'

    def handle(self, *args, **options):
        atms = list(ATM.objects.all().order_by('region', 'location'))
        if not atms:
            self.stdout.write(self.style.WARNING('No ATMs in DB — run seeds first.'))
            return

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO(
            '  Feature 11 — Multilingual Auto-Routing by ATM Region'
        ))
        self.stdout.write('  ' + '─' * 74)
        header = f"  {'ID':>4}  {'Name':<22}  {'Location':<18}  {'Region':<14}  Language"
        self.stdout.write(self.style.MIGRATE_HEADING(header))
        self.stdout.write('  ' + '─' * 74)

        counter: Counter = Counter()
        for a in atms:
            lang = detect_language(a)
            counter[lang] += 1
            meta = LANGUAGE_META.get(lang, {'name': lang})
            row = (
                f"  {a.id:>4}  {_trunc(a.name, 22):<22}  "
                f"{_trunc(a.location, 18):<18}  {_trunc(a.region or '', 14):<14}  "
                f"{lang}  {meta['name']}"
            )
            self.stdout.write(row)

        self.stdout.write('  ' + '─' * 74)
        total = sum(counter.values())
        dist_parts = []
        for code in SUPPORTED_LANGUAGES:
            n = counter.get(code, 0)
            if n == 0:
                continue
            pct = round((n / total) * 100)
            name = LANGUAGE_META[code]['name']
            dist_parts.append(f"{name} {n} ({pct}%)")
        dist = '  ·  '.join(dist_parts) if dist_parts else '—'
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'  Distribution:  {dist}'))
        self.stdout.write(self.style.SUCCESS(f'  Total ATMs:    {total}'))
        self.stdout.write('')
