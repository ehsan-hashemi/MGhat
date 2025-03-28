import { createClient } from "@supabase/supabase-js";

// تنظیمات Supabase
const supabaseUrl = 'https://inmtfqmhyqejuqhjgkhh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXRmcW1oeXFlanVxaGpna2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxODUxNjQsImV4cCI6MjA1ODc2MTE2NH0.mo-F_DDb6W4khZfNGtv6CtRi-AwkUNuyZ5VcHbRuNbA';
const supabase = createClient(supabaseUrl, supabaseKey);

// تابع کمکی برای انتخاب المنت‌ها
function $(id) {
  return document.getElementById(id);
}

/* --------- بخش ورود (Login) --------- */
if ($("login-form")) {
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const fullname = $("fullname").value.trim();
    const username = $("username").value.trim();
    const phone = $("phone").value.trim();
    
    if (!fullname || !username || !phone) {
      alert("لطفاً همه فیلدها را پر کنید!");
      return;
    }
    
    try {
      // بررسی وجود کاربری با شماره تلفن یا نام کاربری مورد استفاده
      const { data: existingUsers, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .or(`phone.eq.${phone},username.eq.${username}`);
      
      if (fetchError) {
        alert("خطا در بررسی پایگاه داده: " + fetchError.message);
        return;
      }
      
      // بررسی تضاد: اگر شماره یا نام کاربری تکراری است اما با اطلاعات وارد شده مطابقت ندارد
      const phoneConflict = existingUsers.some((user) =>
        user.phone === phone && (user.username !== username || user.fullname !== fullname)
      );
      const usernameConflict = existingUsers.some((user) =>
        user.username === username && (user.phone !== phone || user.fullname !== fullname)
      );
      
      if (phoneConflict || usernameConflict) {
        alert("شماره تلفن یا نام کاربری تکراری است و با اطلاعات وارد شده مطابقت ندارد!");
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
      localStorage.setItem("currentUser", JSON.stringify({ fullname, username, phone }));
      // هدایت به صفحه چت
      window.location.href = "../pages/chat.html";
      
    } catch (err) {
      console.error("خطای ثبت نام:", err);
      alert("ثبت نام با خطا مواجه شد!");
    }
  });
}

/* --------- بخش چت (Chat) --------- */
if ($("chat-list")) {
  // اطمینان از ورود کاربر
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) {
    window.location.href = "../pages/login.html";
  }
  const user = JSON.parse(storedUser);
  
  // نمایش پیام خوشامدگویی
  $("user-greeting").textContent = `خوش آمدید، ${user.fullname}`;
  
  // دکمه خروج
  $("logout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "../pages/login.html";
  });
  
  // ارسال پیام
  $("send").addEventListener("click", async () => {
    const recipient = $("recipient").value.trim();
    const messageText = $("message-text").value.trim();
    const fileInput = $("file-upload");
    let fileUrl = null;
    
    if (!recipient) {
      alert("لطفاً نام کاربری گیرنده را وارد کنید!");
      return;
    }
    
    if (!messageText && (!fileInput.files || fileInput.files.length === 0)) {
      alert("لطفاً پیام تایپ کنید یا یک فایل انتخاب کنید!");
      return;
    }
    
    // آپلود فایل (در صورت انتخاب)
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
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
      fileUrl = supabase.storage.from("uploads").getPublicUrl(fileName).publicURL;
    }
    
    try {
      // درج پیام در جدول messages
      const { data, error } = await supabase
        .from("messages")
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
      
      $("message-text").value = "";
      $("file-upload").value = "";
      alert("پیام ارسال شد!");
      loadChatMessages();
    } catch (err) {
      console.error("خطای ارسال پیام:", err);
      alert("خطایی در ارسال پیام رخ داده است!");
    }
  });
  
  // تابع بارگذاری تاریخچه چت
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
  
  // بارگذاری اولیه تاریخچه چت و به‌روزرسانی دوره‌ای هر ۵ ثانیه
  loadChatMessages();
  setInterval(loadChatMessages, 5000);
  
  // نمایش استیکرهای مورد علاقه (به عنوان مثال ساده)
  function loadFavoriteStickers() {
    const favoriteList = $("favorite-list");
    favoriteList.innerHTML = `<li>استیکر 1</li><li>استیکر 2</li>`;
  }
  loadFavoriteStickers();
  
  // تغییر تم: دریافت فایل تم از کاربر و افزودن استایل مربوط به آن به صفحه.
  $("apply-theme").addEventListener("click", () => {
    const themeFileInput = $("theme-file");
    if (themeFileInput.files && themeFileInput.files[0]) {
      const file = themeFileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const themeData = e.target.result;
        // ایجاد یک المنت <style> و افزودن CSS خوانده شده
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