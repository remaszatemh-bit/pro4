import json
import os

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .models import User, Post, Comment, Follow
from .pagination import paginate_posts


def index(request):
    return render(request, "network/index.html")


def following(request):
    return render(request, "network/following.html")


def profile(request, username):
    profile_user = get_object_or_404(User, username=username)
    return render(request, "network/profile.html", {
        "profile_user": profile_user,
        "followers": profile_user.followers.count(),
        "following_count": profile_user.following.count(),
        "is_following": request.user.is_authenticated and Follow.objects.filter(
            user=request.user, following=profile_user
        ).exists(),
    })


@login_required
def edit_profile(request):
    if request.method == "POST":
        request.user.bio = request.POST.get("bio", "").strip()[:160]

        avatar = request.FILES.get("avatar")
        cover = request.FILES.get("cover")

        if avatar:
            if request.user.avatar:
                request.user.avatar.delete(save=False)
            request.user.avatar = avatar
        if cover:
            if request.user.cover:
                request.user.cover.delete(save=False)
            request.user.cover = cover
        request.user.save()
        return HttpResponseRedirect(reverse(
            "profile", args=[request.user.username]
        ))
    return render(request, "network/edit_profile.html")


def posts(request, feed="all", username=None):
    """Return paginated posts as JSON. feed: all | following | profile."""
    if feed == "following":
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=403)
        users = User.objects.filter(followers__user=request.user)
        posts_qs = Post.objects.filter(author__in=users).order_by("-timestamp")
    elif feed == "profile":
        user = get_object_or_404(User, username=username)
        posts_qs = user.posts.all().order_by("-timestamp")
    else:
        posts_qs = Post.objects.all().order_by("-timestamp")

    return paginate_posts(request, posts_qs, request.user)


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "network/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "network/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "network/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "network/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "network/register.html")


def _check_content(content):
    content = content.strip()
    if not content:
        return None, "Content is required."
    if len(content) > 280:
        return None, "Text is too long (max 280 characters)."
    return content, None


def _clean_upload(file, kind):
    """Validate an uploaded image/video. Returns (file, error)."""
    if not file:
        return None, None
    if file.size > 50 * 1024 * 1024:
        return None, f"{kind} is too large (max 50 MB)."
    if kind == "Image":
        allowed = ("image/jpeg", "image/png", "image/gif", "image/webp")
    else:
        allowed = ("video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v", "video/x-msvideo")
    content_type = getattr(file, "content_type", "") or ""
    if content_type not in allowed:
        ext = os.path.splitext(file.name)[1].lower()
        ext_map = {"jpg": "image", "jpeg": "image", "png": "image", "gif": "image", "webp": "image",
                   "mp4": "video", "webm": "video", "ogg": "video", "mov": "video", "avi": "video"}
        if ext not in ext_map or ext_map[ext] != kind.lower():
            return None, f"Unsupported {kind.lower()} format."
    return file, None


@csrf_exempt
@login_required
def new_post(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)

    content, error = _check_content(request.POST.get("content", ""))
    if error:
        return JsonResponse({"error": error}, status=400)

    image, img_err = _clean_upload(request.FILES.get("image"), "Image")
    if img_err:
        return JsonResponse({"error": img_err}, status=400)
    video, vid_err = _clean_upload(request.FILES.get("video"), "Video")
    if vid_err:
        return JsonResponse({"error": vid_err}, status=400)

    post = Post.objects.create(
        author=request.user,
        content=content,
        image=image,
        video=video,
    )
    return JsonResponse(post.serialize(request.user), status=201)


@csrf_exempt
@login_required
def edit_post(request, post_id):
    post = get_object_or_404(Post, pk=post_id)
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)
    if post.author != request.user:
        return JsonResponse({"error": "You can only edit your own posts."}, status=403)

    data = request.POST
    content, error = _check_content(data.get("content", ""))
    if error:
        return JsonResponse({"error": error}, status=400)

    image, img_err = _clean_upload(request.FILES.get("image"), "Image")
    if img_err:
        return JsonResponse({"error": img_err}, status=400)
    video, vid_err = _clean_upload(request.FILES.get("video"), "Video")
    if vid_err:
        return JsonResponse({"error": vid_err}, status=400)

    post.content = content
    if image is not None:
        if post.image:
            post.image.delete(save=False)
        post.image = image
    if video is not None:
        if post.video:
            post.video.delete(save=False)
        post.video = video
    post.save()
    return JsonResponse(post.serialize(request.user))


@csrf_exempt
@login_required
def toggle_like(request, post_id):
    post = get_object_or_404(Post, pk=post_id)
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)

    if post.likes.filter(pk=request.user.pk).exists():
        post.likes.remove(request.user)
    else:
        post.likes.add(request.user)
    return JsonResponse(post.serialize(request.user))


@csrf_exempt
@login_required
def toggle_repost(request, post_id):
    post = get_object_or_404(Post, pk=post_id)
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)

    if post.reposts.filter(pk=request.user.pk).exists():
        post.reposts.remove(request.user)
        reposted = False
    else:
        post.reposts.add(request.user)
        reposted = True
    return JsonResponse({
        "reposts": post.reposts.count(),
        "reposted": reposted,
    })


@csrf_exempt
@login_required
def add_comment(request, post_id):
    post = get_object_or_404(Post, pk=post_id)
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)

    data = json.loads(request.body)
    content, error = _check_content(data.get("content", ""))
    if error:
        return JsonResponse({"error": error}, status=400)

    comment = Comment.objects.create(post=post, author=request.user, content=content)
    return JsonResponse(comment.serialize(), status=201)


@csrf_exempt
@login_required
def toggle_follow(request, username):
    target = get_object_or_404(User, username=username)
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=405)
    if target == request.user:
        return JsonResponse({"error": "You cannot follow yourself."}, status=400)

    follow, created = Follow.objects.get_or_create(user=request.user, following=target)
    if not created:
        follow.delete()
    return JsonResponse({
        "following": created,
        "followers": target.followers.count(),
        "following_count": target.following.count(),
    })
