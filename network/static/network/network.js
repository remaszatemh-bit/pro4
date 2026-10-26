document.addEventListener("DOMContentLoaded", () => {
  const postsContainer = document.querySelector("#posts");
  if (postsContainer) {
    const feed = postsContainer.dataset.feed || "all";
    const profileUser = postsContainer.dataset.username || null;
    loadPosts(feed, profileUser);
  }

  const newPostForm = document.querySelector("#new-post-form");
  if (newPostForm) {
    setupNewPost(newPostForm);
  }

  const followBtn = document.querySelector("#follow-btn");
  if (followBtn) {
    followBtn.addEventListener("click", () => toggleFollow(followBtn));
  }
});

// ---------- Posts ----------

function loadPosts(feed, username, page = 1) {
  let url = `/posts/${feed}`;
  if (username) url += `/${username}`;
  url += `?page=${page}`;

  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load posts.");
      return response.json();
    })
    .then((data) => {
      renderPosts(data.posts);
      renderPagination(data, feed, username);
    })
    .catch((error) => {
      document.querySelector("#posts").innerHTML = `<div class="empty-state">${error.message}</div>`;
    });
}

function avatarHTML(username, avatarUrl, cssClass) {
  if (avatarUrl) {
    return `<img class="${cssClass} avatar-img" src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(username)}" />`;
  }
  return `<span class="${cssClass}">${escapeHTML(username.charAt(0).toUpperCase())}</span>`;
}

function mediaHTML(post) {
  let html = "";
  if (post.image) {
    html += `<img class="post-media" src="${escapeHTML(post.image)}" alt="Post image" loading="lazy" />`;
  }
  if (post.video) {
    html += `<video class="post-media" src="${escapeHTML(post.video)}" controls playsinline preload="metadata" onerror="this.outerHTML='<div class=\"media-error\">⚠️ Video failed to load</div>'"><source src="${escapeHTML(post.video)}" type="video/mp4"></video>`;
  }
  return html;
}

function commentsHTML(post) {
  const items = post.comments
    .map(
      (c) => `
      <div class="comment">
        ${avatarHTML(c.author, c.author_avatar, "comment-avatar")}
        <div class="comment-body">
          <a class="comment-author" href="/profile/${c.author}">${escapeHTML(c.author)}</a>
          <span class="comment-time">${c.timestamp}</span>
          <div class="comment-content">${escapeHTML(c.content)}</div>
        </div>
      </div>`,
    )
    .join("");
  return `<div class="comments-list">${items}</div>`;
}

function renderPosts(posts) {
  const container = document.querySelector("#posts");
  container.innerHTML = "";

  if (posts.length === 0) {
    container.innerHTML = `<div class="empty-state">No posts yet — be the first to share something!</div>`;
    return;
  }

  posts.forEach((post) => {
    const element = document.createElement("article");
    element.className = "post-card";
    element.dataset.id = post.id;

    element.innerHTML = `
      <div class="post-main">
        <a class="post-avatar-link" href="/profile/${post.author}">
          ${avatarHTML(post.author, post.author_avatar, "post-avatar")}
        </a>
        <div class="post-body">
          <div class="post-head">
            <a class="post-author" href="/profile/${post.author}">${escapeHTML(post.author)}</a>
            <span class="post-time">${post.timestamp}</span>
          </div>
          <div class="post-content">${escapeHTML(post.content)}</div>
          <div class="post-media-wrap">${mediaHTML(post)}</div>
          <div class="edit-area" style="display:none;">
            <textarea class="form-control edit-textarea" rows="3" maxlength="280"></textarea>
            <label class="file-pick mt-2">
              📷 <span class="edit-image-label">Replace image</span>
              <input type="file" class="edit-image" accept="image/jpeg,image/png,image/gif,image/webp" hidden />
            </label>
            <label class="file-pick mt-1">
              🎬 <span class="edit-video-label">Replace video</span>
              <input type="file" class="edit-video" accept="video/mp4,video/webm,video/ogg" hidden />
            </label>
            <div class="edit-buttons">
              <button class="btn btn-post btn-sm save-btn">Save</button>
              <button class="btn btn-ghost btn-sm cancel-btn">Cancel</button>
            </div>
          </div>
          <div class="post-actions">
            <button class="action-btn like-btn ${post.liked ? "liked" : ""}" title="Like">
              <span class="action-icon">${post.liked ? "❤️" : "🤍"}</span>
              <span class="likes-count">${post.likes}</span>
            </button>
            <button class="action-btn comment-toggle" title="Comments">
              <span class="action-icon">💬</span>
              <span class="comments-count">${post.comments.length}</span>
            </button>
            <button class="action-btn repost-btn ${post.reposted ? "reposted" : ""}" title="Repost">
              <span class="action-icon">${post.reposted ? "🔁" : "🔄"}</span>
              <span class="reposts-count">${post.reposts}</span>
            </button>
            ${post.editable ? `<button class="action-btn edit-btn" title="Edit post"><span class="action-icon">✏️</span></button>` : ""}
          </div>
          <div class="comments-section" style="display:none;">
            ${commentsHTML(post)}
            <form class="comment-form">
              <input type="text" class="form-control comment-input"
                     placeholder="Write a comment..." maxlength="280" />
              <button type="submit" class="btn btn-post btn-sm">Reply</button>
            </form>
          </div>
        </div>
      </div>
    `;

    if (post.editable) {
      element.querySelector(".edit-btn").addEventListener("click", () => startEdit(element, post));
      const editImage = element.querySelector(".edit-image");
      const editVideo = element.querySelector(".edit-video");
      editImage.addEventListener("change", () => {
        element.querySelector(".edit-image-label").textContent = editImage.files.length ? `✓ ${editImage.files[0].name}` : "Replace image";
      });
      editVideo.addEventListener("change", () => {
        element.querySelector(".edit-video-label").textContent = editVideo.files.length ? `✓ ${editVideo.files[0].name}` : "Replace video";
      });
      element.querySelector(".save-btn").addEventListener("click", () => saveEdit(element, post.id));
      element.querySelector(".cancel-btn").addEventListener("click", () => cancelEdit(element));
    }

    element.querySelector(".like-btn").addEventListener("click", () => toggleLike(element, post.id));
    element.querySelector(".repost-btn").addEventListener("click", () => toggleRepost(element, post.id));
    element.querySelector(".comment-toggle").addEventListener("click", () => {
      const section = element.querySelector(".comments-section");
      section.style.display = section.style.display === "none" ? "block" : "none";
    });
    element.querySelector(".comment-form").addEventListener("submit", (event) => {
      event.preventDefault();
      submitComment(element, post.id);
    });

    container.append(element);
  });
}

function renderPagination(data, feed, username) {
  const pagination = document.querySelector("#pagination");
  pagination.innerHTML = "";

  if (data.num_pages <= 1) return;

  const addItem = (page, label, disabled, current) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""} ${current ? "active" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = label;
    a.addEventListener("click", (event) => {
      event.preventDefault();
      if (!disabled) {
        loadPosts(feed, username, page);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    li.append(a);
    pagination.append(li);
  };

  if (data.has_previous) addItem(data.page - 1, "← Previous", false, false);
  for (let i = 1; i <= data.num_pages; i++) {
    addItem(i, i, false, i === data.page);
  }
  if (data.has_next) addItem(data.page + 1, "Next →", false, false);
}

// ---------- New post ----------

function setupNewPost(form) {
  const textarea = form.querySelector("#new-post-content");
  const counter = form.querySelector("#char-count");
  const imageInput = form.querySelector("#new-post-image");
  const videoInput = form.querySelector("#new-post-video");
  const imageLabel = form.querySelector("#image-file-label");
  const videoLabel = form.querySelector("#video-file-label");

  const bindFilePicker = (input, label) => {
    input.addEventListener("change", () => {
      label.textContent = input.files.length ? `✓ ${input.files[0].name}` : input.id.includes("image") ? "Add image" : "Add video";
    });
  };
  bindFilePicker(imageInput, imageLabel);
  bindFilePicker(videoInput, videoLabel);

  const updateCounter = () => {
    const remaining = 280 - textarea.value.length;
    counter.textContent = remaining;
    counter.classList.toggle("char-warning", remaining < 40);
  };
  textarea.addEventListener("input", updateCounter);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content) return;

    const data = new FormData();
    data.append("content", content);
    if (imageInput.files.length) data.append("image", imageInput.files[0]);
    if (videoInput.files.length) data.append("video", videoInput.files[0]);

    fetch("/new_post", { method: "POST", body: data })
      .then((response) => {
        if (!response.ok) return response.json().then((d) => Promise.reject(d));
        return response.json();
      })
      .then(() => {
        textarea.value = "";
        imageInput.value = "";
        videoInput.value = "";
        imageLabel.textContent = "Add image";
        videoLabel.textContent = "Add video";
        updateCounter();
        loadPosts("all", null, 1);
      })
      .catch((error) => alert(error.error || "Failed to create post."));
  });
}

// ---------- Like / Unlike ----------

function toggleLike(element, postId) {
  fetch(`/like/${postId}`, { method: "POST" })
    .then((response) => {
      if (!response.ok) throw new Error("Log in to like posts.");
      return response.json();
    })
    .then((post) => {
      element.querySelector(".likes-count").textContent = post.likes;
      const likeBtn = element.querySelector(".like-btn");
      likeBtn.querySelector(".action-icon").textContent = post.liked ? "❤️" : "🤍";
      likeBtn.classList.toggle("liked", post.liked);
    })
    .catch((error) => alert(error.message));
}

// ---------- Repost ----------

function toggleRepost(element, postId) {
  fetch(`/repost/${postId}`, { method: "POST" })
    .then((response) => {
      if (!response.ok) return response.json().then((d) => Promise.reject(d));
      return response.json();
    })
    .then((data) => {
      element.querySelector(".reposts-count").textContent = data.reposts;
      const repostBtn = element.querySelector(".repost-btn");
      repostBtn.querySelector(".action-icon").textContent = data.reposted ? "🔁" : "🔄";
      repostBtn.classList.toggle("reposted", data.reposted);
    })
    .catch((error) => alert(error.error || "Failed to repost."));
}

// ---------- Comments ----------

function submitComment(element, postId) {
  const input = element.querySelector(".comment-input");
  const content = input.value.trim();
  if (!content) return;

  fetch(`/comment/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
    .then((response) => {
      if (!response.ok) return response.json().then((d) => Promise.reject(d));
      return response.json();
    })
    .then((comment) => {
      input.value = "";
      const list = element.querySelector(".comments-list");
      const item = document.createElement("div");
      item.className = "comment";
      item.innerHTML = `
        ${avatarHTML(comment.author, comment.author_avatar, "comment-avatar")}
        <div class="comment-body">
          <a class="comment-author" href="/profile/${comment.author}">${escapeHTML(comment.author)}</a>
          <span class="comment-time">${comment.timestamp}</span>
          <div class="comment-content">${escapeHTML(comment.content)}</div>
        </div>`;
      list.append(item);
      element.querySelector(".comments-count").textContent = list.querySelectorAll(".comment").length;
    })
    .catch((error) => alert(error.error || "Failed to add comment."));
}

// ---------- Edit ----------

function startEdit(element, post) {
  element.querySelector(".post-content").style.display = "none";
  element.querySelector(".post-media-wrap").style.display = "none";
  element.querySelector(".post-actions").style.display = "none";
  const editArea = element.querySelector(".edit-area");
  editArea.style.display = "block";
  editArea.querySelector(".edit-textarea").value = post.content;
  editArea.querySelector(".edit-image").value = "";
  editArea.querySelector(".edit-video").value = "";
  editArea.querySelector(".edit-image-label").textContent = "Replace image";
  editArea.querySelector(".edit-video-label").textContent = "Replace video";
  editArea.querySelector(".edit-textarea").focus();
}

function cancelEdit(element) {
  element.querySelector(".post-content").style.display = "";
  element.querySelector(".post-media-wrap").style.display = "";
  element.querySelector(".post-actions").style.display = "";
  element.querySelector(".edit-area").style.display = "none";
}

function saveEdit(element, postId) {
  const content = element.querySelector(".edit-textarea").value.trim();
  if (!content) return;

  const data = new FormData();
  data.append("content", content);
  const editImage = element.querySelector(".edit-image");
  const editVideo = element.querySelector(".edit-video");
  if (editImage.files.length) data.append("image", editImage.files[0]);
  if (editVideo.files.length) data.append("video", editVideo.files[0]);

  fetch(`/edit_post/${postId}`, { method: "POST", body: data })
    .then((response) => {
      if (!response.ok) return response.json().then((d) => Promise.reject(d));
      return response.json();
    })
    .then((post) => {
      element.querySelector(".post-content").textContent = post.content;
      element.querySelector(".post-media-wrap").innerHTML = mediaHTML(post);
      cancelEdit(element);
    })
    .catch((error) => alert(error.error || "Failed to edit post."));
}

// ---------- Follow / Unfollow ----------

function toggleFollow(button) {
  const username = button.dataset.username;

  fetch(`/follow/${username}`, { method: "POST" })
    .then((response) => {
      if (!response.ok) return response.json().then((d) => Promise.reject(d));
      return response.json();
    })
    .then((data) => {
      document.querySelector("#followers-count").textContent = data.followers;
      document.querySelector("#following-count").textContent = data.following_count;
      button.textContent = data.following ? "Unfollow" : "Follow";
      button.classList.toggle("following-active", data.following);
    })
    .catch((error) => alert(error.error || "Failed to update follow status."));
}

// ---------- Helpers ----------

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
