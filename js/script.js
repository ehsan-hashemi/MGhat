import { createClient } from "@supabase/supabase-js";

// تنظیمات Supabase
const supabaseUrl = 'https://inmtfqmhyqejuqhjgkhh.supabase.co'; // URL پروژه Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXRmcW1oeXFlanVxaGpna2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxODUxNjQsImV4cCI6MjA1ODc2MTE2NH0.mo-F_DDb6W4khZfNGtv6CtRi-AwkUNuyZ5VcHbRuNbA'; // کلید عمومی (Anon Key) از تنظیمات پروژه Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// تابع کمکی برای دسترسی به المنت‌ها با استفاده از شناسه
function $(id) {
  return document.getElementById(id);
}

/*
  اگر المنت با شناسه "login-form" وجود داشته باشد،
  فرض می‌کنیم این صفحه مربوط به ورود/ثبت‌نام کاربر است.
*/
if ($('login-form')) {
  // ثبت‌نام کاربران
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullname = $('fullname').value;
    const username = $('username').value;
    const phone = $('phone').value;

    if (fullname && username && phone) {
      const user = { fullname, username, phone };

      try {
        // ذخیره اطلاعات کاربر در دیتابیس Supabase (جدول "users")
        const { data, error } = await supabase
          .from('users')
          .insert([user]);

        if (error) {
          alert("خطا هنگام ثبت نام: " + error.message);
          return;
        }
        // ذخیره کاربر در localStorage به عنوان نشانه ورود موفق
        localStorage.setItem('currentUser', JSON.stringify(user));
        // هدایت به صفحه چت
        window.location.href = "../pages/chat.html";
      } catch (err) {
        console.error("Registration error:", err);
        alert("ثبت نام با خطا مواجه شد!");
      }
    } else {
      alert("لطفاً همه فیلدها را پر کن.");
    }
  });
}

/*
  اگر المنت با شناسه "chat-list" وجود داشته باشد،
  فرض می‌کنیم این فایل در صفحه چت استفاده می‌شود.
*/
if ($('chat-list')) {
  // اطمینان از ورود کاربر: اگر اطلاعات کاربر در localStorage نباشد، به صفحه ورود هدایت می‌کنیم.
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) {
    window.location.href = "../pages/login.html";
  }
  
  const user = JSON.parse(storedUser);
  // نمایش پیام خوشامدگویی شامل نام کاربر
  $('user-greeting').textContent = `خوش آمدید، ${user.fullname}`;

  // خروج از سیستم: حذف اطلاعات کاربر از localStorage
  $('logout').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = "../pages/login.html";
  });

  // ارسال پیام
  $('send').addEventListener('click', async () => {
    const recipient = $('recipient').value;
    const messageText = $('message-text').value;
    const fileInput = $('file-upload');
    let fileUrl = null;

    // اگر فایل انتخاب شده داشته باشد (مثل استیکر یا مدیا)
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const fileName = `${new Date().getTime()}-${file.name}`;
      
      // آپلود فایل به Supabase Storage (باکت 'uploads' باید از قبل ایجاد شده باشد)
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('uploads')
        .upload(fileName, file);

      if (fileError) {
        console.error("خطا در آپلود فایل:", fileError);
        alert("خطا در آپلود فایل: " + fileError.message);
        return;
      }
      // دریافت URL عمومی فایل آپلود شده
      fileUrl = supabase
        .storage
        .from('uploads')
        .getPublicUrl(fileName)
        .publicURL;
    }

    // درج پیام در دیتابیس Supabase (جدول "messages")
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender: user.username,
          recipient: recipient,
          message: messageText,
          file_url: fileUrl,
          created_at: new Date()
        }]);

      if (error) {
        console.error("خطا در ارسال پیام:", error);
        alert("خطا در ارسال پیام: " + error.message);
        return;
      }
      // پاکسازی فرم پس از ارسال پیام
      $('message-text').value = "";
      $('file-upload').value = "";
      alert("پیام ارسال شد!");
      loadChatMessages();
    } catch (err) {
      console.error("خطای غیرمنتظره:", err);
      alert("خطایی در ارسال پیام روی داده است!");
    }
  });

  // تابعی برای بارگذاری تاریخچه چت از دیتابیس
  async function loadChatMessages() {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error("خطا در دریافت پیام‌ها:", error);
        return;
      }

      const chatList = $('chat-list');
      chatList.innerHTML = "";
      messages.forEach((msg) => {
        const li = document.createElement('li');
        li.textContent = `[${new Date(msg.created_at).toLocaleTimeString()}] ${msg.sender} -> ${msg.recipient}: ${msg.message}`;
        if (msg.file_url) {
          const mediaLink = document.createElement('a');
          mediaLink.href = msg.file_url;
          mediaLink.textContent = "نمایش فایل";
          mediaLink.target = "_blank";
          li.appendChild(document.createElement('br'));
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

  // به‌روزرسانی تاریخچه چت به‌طور دوره‌ای (هر ۵ ثانیه)
  setInterval(loadChatMessages, 5000);

  // نمایش استیکرهای مورد علاقه (مثال ساده)
  function loadFavoriteStickers() {
    const favoriteList = $('favorite-list');
    favoriteList.innerHTML = `<li>استیکر 1</li><li>استیکر 2</li>`;
  }
  loadFavoriteStickers();

  // قابلیت تغییر تم: بارگذاری فایل تم از کاربر و اعمال آن به صفحه
  $('apply-theme').addEventListener('click', () => {
    const themeFileInput = $('theme-file');
    if (themeFileInput.files && themeFileInput.files[0]) {
      const file = themeFileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const themeData = e.target.result;
        const style = document.createElement('style');
        style.innerHTML = themeData;
        document.head.appendChild(style);
        alert("تم به‌کار گرفته شد!");
      }
      reader.readAsText(file);
    } else {
      alert("لطفاً یک فایل تم انتخاب کن.");
    }
  });
}