from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    avatar = models.ImageField(
        upload_to="profiles/avatars/", blank=True, null=True
    )
    cover = models.ImageField(
        upload_to="profiles/covers/", blank=True, null=True
    )
    bio = models.TextField(max_length=160, blank=True)

    def avatar_letter(self):
        return (self.avatar or self.username[0]).upper()

    def serialize(self):
        return {
            "id": self.id,
            "username": self.username,
            "avatar": self.avatar.url if self.avatar else None,
            "bio": self.bio,
            "followers": self.followers.count(),
            "following": self.following.count(),
        }


class Post(models.Model):
    author = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="posts"
    )
    content = models.TextField(max_length=280)
    image = models.ImageField(upload_to="posts/images/", blank=True, null=True)
    video = models.FileField(
        upload_to="posts/videos/", blank=True, null=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    likes = models.ManyToManyField("User", blank=True, related_name="liked_posts")
    reposts = models.ManyToManyField("User", blank=True, related_name="reposted_posts")

    class Meta:
        ordering = ["-timestamp"]

    def serialize(self, user=None):
        return {
            "id": self.id,
            "author": self.author.username,
            "author_id": self.author.id,
            "author_avatar": self.author.avatar.url if self.author.avatar else None,
            "content": self.content,
            "image": self.image.url if self.image else None,
            "video": self.video.url if self.video else None,
            "timestamp": self.timestamp.strftime("%b %d %Y, %I:%M %p"),
            "likes": self.likes.count(),
            "liked": user.is_authenticated and self.likes.filter(pk=user.pk).exists(),
            "reposts": self.reposts.count(),
            "reposted": user.is_authenticated and self.reposts.filter(pk=user.pk).exists(),
            "editable": user.is_authenticated and self.author == user,
            "comments": [
                c.serialize() for c in self.comments.all().order_by("timestamp")
            ],
        }

    def __str__(self):
        return f"{self.author}: {self.content[:50]}"


class Comment(models.Model):
    post = models.ForeignKey(
        "Post", on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="comments"
    )
    content = models.TextField(max_length=280)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def serialize(self):
        return {
            "id": self.id,
            "author": self.author.username,
            "author_avatar": self.author.avatar.url if self.author.avatar else None,
            "content": self.content,
            "timestamp": self.timestamp.strftime("%b %d %Y, %I:%M %p"),
        }

    def __str__(self):
        return f"{self.author} on post {self.post_id}"


class Follow(models.Model):
    user = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="followers"
    )

    class Meta:
        unique_together = ("user", "following")

    def __str__(self):
        return f"{self.user} follows {self.following}"
