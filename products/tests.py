import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from products.models import Product
from django.core.cache import cache

pytestmark = pytest.mark.django_db

client = APIClient()

def test_product_list_returns_products():
    Product.objects.create(name="Product 1", price=1000)
    Product.objects.create(name="Product 2", price=2000)
    response = client.get(reverse('product-list'))
    assert response.status_code == 200
    assert len(response.data) == 2
    assert response.data[0]['name'] == "Product 1"

def test_product_list_with_price_filter():
    Product.objects.create(name="Cheap", price=100)
    Product.objects.create(name="Expensive", price=100000)
    response = client.get(reverse('product-list') + '?min_price=50000')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['name'] == "Expensive"

def test_parse_products_triggers_command(monkeypatch):
    def fake_call_command(name, search):
        assert name == 'parse_wb'
        assert search == 'phone'

    monkeypatch.setattr("products.views.call_command", fake_call_command)
    response = client.get(reverse('parse-products') + '?search=phone')
    assert response.status_code == 200
    response_json = response.json()
    assert 'parsed' in response_json

def test_parse_products_without_search():
    response = client.get(reverse('parse-products'))
    assert response.status_code == 400
    response_json = response.json()
    assert 'error' in response_json

def test_history_returns_cached_data():
    history_data = ['ноутбук', 'телефон']
    cache.set('search_history', history_data)
    response = client.get(reverse('search-history'))
    assert response.status_code == 200
    assert response.data == history_data
