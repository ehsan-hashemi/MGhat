import { createClient } from "@supabase/supabase-js";

// تنظیمات Supabase
const supabaseUrl = 'https://inmtfqmhyqejuqhjgkhh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXRmcW1oeXFlanVxaGpna2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxODUxNjQsImV4cCI6MjA1ODc2MTE2NH0.mo-F_DDb6W4khZfNGtv6CtRi-AwkUNuyZ5VcHbRuNbA';
const supabase = createClient(supabaseUrl, supabaseKey);

// تابع کمکی برای انتخاب المنت
function $(id) {
  return document.getElementById(id);
}

/* ---------------------------
   صفحه ورود (login.html)
---------------------------- */
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
      // بررسی وجود کاربری با شماره تلفن یا نام کاربری مشابه
      const { data: existingUsers, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .or(`phone.eq.${phone},username.eq.${username}`);
      
      if (fetchError) {
        alert("خطا در بررسی پایگاه داده: " + fetchError.message);
        return;
      }
      
      // بررسی تضاد اطلاعات (برای جلوگیری از تکرار ناصحیح)
      const phoneConflict = existingUsers.some(user =>
        user.phone === phone && (user.username !== username || user.fullname !== fullname)
      );
      const usernameConflict = existingUsers.some(user =>
        user.username === username && (user.phone !== phone || user.fullname !== fullname)
      );
      
      if (phoneConflict || usernameConflict) {
        alert("شماره تلفن یا نام کاربری تکراری است و با اطلاعات وارد شده مطابقت ندارد!");
        return;
      }
      
      // ثبت نام کاربر
      const { data, error: insertError } = await supabase
        .from("users")
        .insert([{ fullname, username, phone }]);
      
      if (insertError) {
        alert("خطا در ثبت اطلاعات: " + insertError.message);
        return;
      }
      
      localStorage.setItem("currentUser", JSON.stringify({ fullname, username, phone }));
      // پس از موفقیت، هدایت به صفحه لیست چت
      window.location.href = "MGhat/pages/chat-list.html";
    } catch (err) {
      console.error("خطای ثبت نام:", err);
      alert("ثبت نام با خطا مواجه شد!");
    }
  });
}

/* ---------------------------
   صفحه لیست چت (chat-list.html)
---------------------------- */
if ($("contact-list")) {
  // اطمینان از ورود کاربر
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) {
    window.location.href = "login.html";
  }
  const currentUser = JSON.parse(storedUser);
  $("user-greeting").textContent = `خوش آمدید، ${currentUser.fullname}`;
  
  // دکمه خروج
  $("logout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
  
  // دریافت لیست کاربران (مخاطبین) به جز خود
  async function loadContacts() {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .neq("username", currentUser.username);
      if (error) {
        console.error("خطا در دریافت مخاطبین:", error);
        return;
      }
      const contactList = $("contact-list");
      contactList.innerHTML = "";
      users.forEach(user => {
        const li = document.createElement("li");
        li.textContent = `${user.fullname} (@${user.username})`;
        // با کلیک روی مخاطب، به صفحه گفتگو بروید. مخاطب به عنوان پارامتر در URL قرار می‌گیرد.
        li.addEventListener("click", () => {
          window.location.href = `chat.html?contact=${user.username}&fullname=${encodeURIComponent(user.fullname)}`;
        });
        contactList.appendChild(li);
      });
    } catch (err) {
      console.error("خطا در بارگذاری مخاطبین:", err);
    }
  }
  loadContacts();
}

/* ---------------------------
   صفحه گفتگو (chat.html)
---------------------------- */
if ($("conversation")) {
  // اطمینان از ورود کاربر
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) {
    window.location.href = "login.html";
  }
  const currentUser = JSON.parse(storedUser);
  
  // دریافت پارامتر مخاطب از URL
  const params = new URLSearchParams(window.location.search);
  const contactUsername = params.get("contact");
  const contactFullname = params.get("fullname") || contactUsername;
  
  if (!contactUsername) {
    alert("مخاطب مشخص نشده است!");
    window.location.href = "chat-list.html";
  }
  
  $("user-greeting").textContent = `خوش آمدید، ${currentUser.fullname}`;
  $("contact-name").textContent = contactFullname;
  
  // دکمه خروج
  $("logout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
  // دکمه بازگشت به لیست چت
  $("back-to-list").addEventListener("click", () => {
    window.location.href = "chat-list.html";
  });
  
  // ارسال پیام
  $("send").addEventListener("click", async () => {
    const messageText = $("message-text").value.trim();
    const fileInput = $("file-upload");
    let fileUrl = null;
    
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
      fileUrl = supabase
        .storage
        .from("uploads")
        .getPublicUrl(fileName)
        .publicURL;
    }
    
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([{
          sender: currentUser.username,
          recipient: contactUsername,
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
      loadConversation();
    } catch (err) {
      console.error("خطای ارسال پیام:", err);
      alert("خطایی در ارسال پیام رخ داده است!");
    }
  });
  
  // تابع بارگذاری گفتگو
  async function loadConversation() {
    try {
      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .or(`(sender.eq.${currentUser.username},recipient.eq.${contactUsername}),(sender.eq.${contactUsername},recipient.eq.${currentUser.username})`)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("خطا در دریافت پیام‌ها:", error);
        return;
      }
      const chatList = $("chat-list");
      chatList.innerHTML = "";
      messages.forEach(msg => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${msg.sender}:</strong> ${msg.message} <br><small>${new Date(msg.created_at).toLocaleString()}</small>`;
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
      console.error("خطا در بارگذاری گفتگو:", err);
    }
  }
  
  // بارگذاری اولیه گفتگو و به‌روزرسانی دوره‌ای
  loadConversation();
  setInterval(loadConversation, 5000);
  
  // (اختیاری) قابلیت تغییر تم در صفحه گفتگو (می‌توانید از همان کد صفحه چت استفاده کنید)
  // اینجا مثال ساده‌ای از تغییر تم آورده شده
  // فرض کنید یک دکمه با شناسه apply-theme در صفحه وجود دارد.
  if ($("apply-theme")) {
    $("apply-theme").addEventListener("click", () => {
      const themeFileInput = $("theme-file");
      if (themeFileInput.files && themeFileInput.files[0]) {
        const file = themeFileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
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
}
