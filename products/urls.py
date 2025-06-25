from django.urls import path
from . import views

urlpatterns = [
    path('products/', views.ProductListAPIView.as_view(), name='product-list'),
    path('parse/', views.parse_products, name='parse-products'),
    path('history/', views.HistoryAPIView.as_view(), name='search-history'),
]
