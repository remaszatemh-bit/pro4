from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Post, Follow


class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "content", "timestamp")
    search_fields = ("author__username", "content")


class FollowAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "following")


admin.site.register(User, UserAdmin)
admin.site.register(Post, PostAdmin)
admin.site.register(Follow, FollowAdmin)
