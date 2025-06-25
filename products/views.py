from django.shortcuts import render
from rest_framework.generics import ListAPIView
from .models import Product
from .serializers import ProductSerializer
from django.http import JsonResponse
from django.core.management import call_command
from rest_framework.filters import OrderingFilter
from rest_framework.views import APIView
from rest_framework.response import Response

def index(request):
    return render(request, 'index.html')

class HistoryAPIView(APIView):
    def get(self, request):
        from django.core.cache import cache

        history = cache.get('search_history', [])
        return Response(history)

class ProductListAPIView(ListAPIView):
    serializer_class = ProductSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['name', 'price', 'discount_price', 'rating', 'reviews']
    ordering = ['name']  # дефолтная сортировка по имени

    def get_queryset(self):
        qs = Product.objects.all()
        min_price   = self.request.GET.get('min_price')
        max_price   = self.request.GET.get('max_price')
        min_rating  = self.request.GET.get('min_rating')
        min_reviews = self.request.GET.get('min_reviews')

        if min_price:
            qs = qs.filter(price__gte=float(min_price))
        if max_price:
            qs = qs.filter(price__lte=float(max_price))
        if min_rating:
            qs = qs.filter(rating__gte=float(min_rating))
        if min_reviews:
            qs = qs.filter(reviews__gte=int(min_reviews))
        return qs


def parse_products(request):
    search = request.GET.get('search', '').strip()
    if not search:
        return JsonResponse({'error': 'Search query is required'}, status=400)

    Product.objects.all().delete()
    call_command('parse_wb', search)
    count = Product.objects.count()
    return JsonResponse({'parsed': count})