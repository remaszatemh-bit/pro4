from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.http import JsonResponse

POSTS_PER_PAGE = 10


def paginate_posts(request, posts_qs, user):
    paginator = Paginator(posts_qs, POSTS_PER_PAGE)
    page_number = request.GET.get("page", 1)

    try:
        page_obj = paginator.page(page_number)
    except (PageNotAnInteger, EmptyPage):
        return JsonResponse({"error": "Page not found."}, status=404)

    return JsonResponse({
        "posts": [post.serialize(user) for post in page_obj.object_list],
        "page": page_obj.number,
        "num_pages": paginator.num_pages,
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
    })
