import { createClient } from "@supabase/supabase-js";

// تنظیمات Supabase
const supabaseUrl = 'https://inmtfqmhyqejuqhjgkhh.supabase.co'; // URL پروژه Supabase
const supabaseKey = 'YOUR_ACTUAL_ANON_KEY'; // کلید عمومی (Anon Key) از تنظیمات پروژه Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// تابع کمکی برای دسترسی آسان به المنت‌ها
function $(id) {
  return document.getElementById(id);
}

/*
  اگر در صفحه ورود (login.html) باشیم،
  کد ورود و ثبت‌نام اجرا می‌شود.
*/
if ($("login-form")) {
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullname = $("fullname").value;
    const username = $("username").value;
    const phone = $("phone").value;

    if (fullname && username && phone) {
      try {
        // بررسی وجود کاربران با شماره تلفن یا نام کاربری مشابه
        const { data: existingUsers, error: fetchError } = await supabase
          .from("users")
          .select("*")
          .or(`phone.eq.${phone},username.eq.${username}`);

        if (fetchError) {
          alert("خطا در بررسی پایگاه داده: " + fetchError.message);
          return;
        }

        // بررسی تضاد اطلاعات:
        // اگر شماره تلفن تکراری است ولی نام و نام کاربری همخوانی ندارد یا
        // اگر نام کاربری تکراری است ولی شماره تلفن و نام کاربر همخوانی ندارد.
        const phoneConflict = existingUsers.some(
          (user) =>
            user.phone === phone &&
            user.username !== username &&
            user.fullname !== fullname
        );
        const usernameConflict = existingUsers.some(
          (user) =>
            user.username === username &&
            user.phone !== phone &&
            user.fullname !== fullname
        );

        if (phoneConflict || usernameConflict) {
          alert(
            "شماره تلفن یا نام کاربری تکراری است و با اطلاعات وارد شده مطابقت ندارد!"
          );
          return;
        }

        // ثبت اطلاعات کاربر در جدول users
        const { data, error: insertError } = await supabase
          .from("users")
          .insert([{ fullname, username, phone }]);

        if (insertError) {
          alert("خطا در ثبت اطلاعات: " + insertError.message);
          return;
        }

        // ذخیره کاربر در localStorage به عنوان نشانه ورود موفق
        localStorage.setItem(
          "currentUser",
          JSON.stringify({ fullname, username, phone })
        );
        // هدایت به صفحه چت
        window.location.href = "MGhat/pages/chat.html";
      } catch (err) {
        console.error("Error during registration:", err);
        alert("ثبت نام با خطا مواجه شد!");
      }
    } else {
      alert("لطفاً همه فیلدها را پر کنید!");
    }
  });
}

/*
  اگر در صفحه چت (chat.html) باشیم،
  کدهای مربوط به خروج، ارسال پیام و بارگزاری تاریخچه چت اجرا می‌شوند.
*/
if ($("chat-list")) {
  // اطمینان از ورود کاربر: اگر اطلاعات کاربر در localStorage نباشد، هدایت به صفحه ورود.
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) {
    window.location.href = "../pages/login.html";
  }
  const user = JSON.parse(storedUser);

  // نمایش پیام خوشامدگویی با نام کاربر
  $("user-greeting").textContent = `خوش آمدید، ${user.fullname}`;

  // دکمه خروج: حذف اطلاعات کاربر از localStorage و هدایت به صفحه ورود
  $("logout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "../pages/login.html";
  });

  // ارسال پیام
  $("send").addEventListener("click", async () => {
    const recipient = $("recipient").value;
    const messageText = $("message-text").value;
    const fileInput = $("file-upload");
    let fileUrl = null;

    // آپلود فایل (در صورت انتخاب) به Supabase Storage
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      // استفاده از timestamp برای یکتا بودن نام فایل
      const fileName = `${new Date().getTime()}-${file.name}`;
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from("uploads")
        .upload(fileName, file);

      if (fileError) {
        console.error("خطا در آپلود فایل:", fileError);
        alert("خطا در آپلود فایل: " + fileError.message);
        return;
      }

      // دریافت URL عمومی فایل آپلود شده از Supabase Storage
      fileUrl = supabase.storage.from("uploads").getPublicUrl(fileName).publicURL;
    }

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            sender: user.username,
            recipient: recipient,
            message: messageText,
            file_url: fileUrl,
            created_at: new Date(),
          },
        ]);

      if (error) {
        console.error("خطا در ارسال پیام:", error);
        alert("خطا در ارسال پیام: " + error.message);
        return;
      }
      // پاکسازی فرم ارسال پیام
      $("message-text").value = "";
      $("file-upload").value = "";
      alert("پیام ارسال شد!");
      loadChatMessages();
    } catch (err) {
      console.error("خطای غیرمنتظره:", err);
      alert("خطایی در ارسال پیام روی داده است!");
    }
  });

  // تابع بارگذاری تاریخچه چت از دیتابیس
  async function loadChatMessages() {
    try {
      const { data: messages, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (fetchError) {
        console.error("خطا در دریافت پیام‌ها:", fetchError);
        return;
      }

      const chatList = $("chat-list");
      chatList.innerHTML = "";
      messages.forEach((msg) => {
        const li = document.createElement("li");
        li.textContent = `[${new Date(msg.created_at).toLocaleTimeString()}] ${msg.sender} -> ${msg.recipient}: ${msg.message}`;
        if (msg.file_url) {
          const mediaLink = document.createElement("a");
          mediaLink.href = msg.file_url;
          mediaLink.textContent = "نمایش فایل";
          mediaLink.target = "_blank";
          li.appendChild(document.createElement("br"));
          li.appendChild(mediaLink);
        }
        chatList.appendChild(li);
      });
    } catch (err) {
      console.error("خطا در بارگذاری پیام‌ها:", err);
    }
  }

  // بارگذاری اولیه تاریخچه چت
  loadChatMessages();
  // به‌روزرسانی تاریخچه چت هر ۵ ثانیه
  setInterval(loadChatMessages, 5000);

  // نمایش استیکرهای مورد علاقه (مثال ساده)
  function loadFavoriteStickers() {
    const favoriteList = $("favorite-list");
    favoriteList.innerHTML = `<li>استیکر 1</li><li>استیکر 2</li>`;
  }
  loadFavoriteStickers();

  // تغییر تم: دریافت فایل تم از کاربر و اعمال آن به صفحه
  $("apply-theme").addEventListener("click", () => {
    const themeFileInput = $("theme-file");
    if (themeFileInput.files && themeFileInput.files[0]) {
      const file = themeFileInput.files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        const themeData = e.target.result;
        const style = document.createElement("style");
        style.innerHTML = themeData;
        document.head.appendChild(style);
        alert("تم به‌کار گرفته شد!");
      };
      reader.readAsText(file);
    } else {
      alert("لطفاً یک فایل تم انتخاب کنید.");
    }
  });
}