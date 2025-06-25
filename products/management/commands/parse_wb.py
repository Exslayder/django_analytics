from django.core.management.base import BaseCommand
import requests
from products.models import Product

class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('search', type=str, help='Search query/category')

    def handle(self, *args, **options):
        search = options['search']
        base = 'https://search.wb.ru/exactmatch/ru/common/v4/search?'
        params = {
            'appType': 1,
            'couponsGeo': '12,3,18,15,21',
            'curr': 'rub',
            'dest': '-1029256,-102269,-1785823',
            'locale': 'ru',
            'query': search,
            'queryType': 'search',
            'resultset': 'catalog',
            'sort': 'popular',
            'page': 1,
            'limit': 100,
        }
        qs = '&'.join(f'{k}={requests.utils.quote(str(v))}' for k, v in params.items())
        api_url = base + qs

        resp = requests.get(api_url)
        resp.raise_for_status()
        data = resp.json()

        items = data.get('data', {}).get('products', [])
        if not items:
            self.stdout.write(self.style.WARNING('No products found for query'))
            return

        Product.objects.all().delete()
        count = 0

        for item in items:
            name = item.get('name', '')
            sale_price_u = item.get('salePriceU') or item.get('priceU', 0)
            price = sale_price_u / 100.0
            original_price_u = item.get('priceU') or sale_price_u
            discount_price = original_price_u / 100.0

            rating = item.get('rating', 0.0)
            reviews = item.get('feedbacks', 0)

            wb_id = item.get('id') or item.get('nm_id')
            if wb_id:
                product_url = f'https://www.wildberries.ru/catalog/{wb_id}/detail.aspx'
            else:
                product_url = ''

            Product.objects.create(
                name=name,
                price=price,
                discount_price=discount_price,
                rating=rating,
                reviews=reviews,
                url=product_url
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'Parsing complete: {count} products imported'))
