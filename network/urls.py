from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),

    # Pages
    path("following", views.following, name="following"),
    path("profile/<str:username>", views.profile, name="profile"),
    path("edit_profile", views.edit_profile, name="edit_profile"),

    # API
    path("posts/<str:feed>", views.posts, name="posts"),
    path("posts/<str:feed>/<str:username>", views.posts, name="posts_user"),
    path("posts", views.posts, name="posts_all"),
    path("new_post", views.new_post, name="new_post"),
    path("edit_post/<int:post_id>", views.edit_post, name="edit_post"),
    path("like/<int:post_id>", views.toggle_like, name="toggle_like"),
    path("repost/<int:post_id>", views.toggle_repost, name="toggle_repost"),
    path("comment/<int:post_id>", views.add_comment, name="add_comment"),
    path("follow/<str:username>", views.toggle_follow, name="toggle_follow"),
]
