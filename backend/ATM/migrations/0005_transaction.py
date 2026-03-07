import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ATM', '0004_add_userprofile_assignedto_charfield'),
    ]

    operations = [
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cardHash', models.CharField(max_length=64)),
                ('amount', models.FloatField()),
                ('transactionType', models.CharField(
                    choices=[('WITHDRAWAL', 'WITHDRAWAL'), ('BALANCE_CHECK', 'BALANCE_CHECK'), ('DEPOSIT', 'DEPOSIT')],
                    default='WITHDRAWAL', max_length=20,
                )),
                ('latitude',  models.FloatField(blank=True, null=True)),
                ('longitude', models.FloatField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('COMPLETED', 'COMPLETED'), ('BLOCKED', 'BLOCKED'), ('FLAGGED', 'FLAGGED'), ('FAILED', 'FAILED')],
                    default='COMPLETED', max_length=20,
                )),
                ('anomalyFlagId', models.IntegerField(blank=True, null=True)),
                ('timestamp',  models.DateTimeField(default=django.utils.timezone.now)),
                ('createdAt',  models.DateTimeField(default=django.utils.timezone.now)),
                ('atm', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='atm_transactions',
                    to='ATM.atm',
                )),
            ],
        ),
    ]
