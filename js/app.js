const App = {
  state: {
    currentUser: null,
    currentPage: "login",
    examMode: null,
    currentQuestionIndex: 0,
    questions: [],
    answers: {},
    timeRemaining: 0,
    timerInterval: null,
    thinkingTimer: null,
    thinkingSeconds: 0,
    isExam: false,
    isTrial: false,
    savedProgress: null,
    markedQuestions: new Set(),
    collectedQuestions: new Set(),
    startTime: null,
    selectedCategory: "国职游泳指导员初级",
    returnPage: null,
    sourceType: null,
    navQuestionCount: 0,
    navSourceType: null,
    isOnline: navigator.onLine,
    cloudSynced: false,
  },

  async init() {
    await this.loadSettings();
    await this.checkSavedProgress();
    this.bindEvents();
    this.loadFontAwesome();
    this.bindNetworkEvents();
    this.initCloud();
    await this.loadQuestionBank();
  },

  bindNetworkEvents() {
    window.addEventListener("online", () => {
      this.state.isOnline = true;
      this.updateNetworkStatus();
      if (CloudConfig.enableCloud) {
        Utils.showToast("网络已连接，数据同步中...", "info");
        this.syncAllData();
      }
    });

    window.addEventListener("offline", () => {
      this.state.isOnline = false;
      this.updateNetworkStatus();
      Utils.showToast("网络已断开，将使用本地存储", "warning");
    });
  },

  updateNetworkStatus() {
    const statusIndicator = document.getElementById("syncStatusIndicator");
    if (statusIndicator) {
      if (this.state.isOnline) {
        statusIndicator.innerHTML = '<i class="fa fa-globe"></i> 在线';
        statusIndicator.className = "sync-status online";
      } else {
        statusIndicator.innerHTML = '<i class="fa fa-plane"></i> 离线';
        statusIndicator.className = "sync-status offline";
      }
    }
  },

  async initCloud() {
    if (!CloudConfig.enableCloud) return;

    try {
      await CloudStorage.init();
      this.state.cloudSynced = true;
      console.log("云端存储初始化成功");

      if (this.state.isOnline) {
        Utils.showToast("云端存储已连接", "success");
      }
    } catch (e) {
      console.warn("云端存储初始化失败:", e);
      this.state.cloudSynced = false;
    }
  },

  async syncAllData() {
    if (!CloudConfig.enableCloud || !this.state.isOnline) return;

    console.log("开始同步数据...");
    try {
      await this.updateMenuStats();
      Utils.showToast("数据同步完成", "success");
    } catch (e) {
      console.warn("数据同步失败:", e);
    }
  },

  async loadSettings() {
    const settings = await Storage.getSettings();
    const defaultExamInfo = {
      考试类型: "国职游泳救生员（初级/中级/高级）",
      考试时间: "每月第二周周六",
      考试地点: "各省市体育职业鉴定站",
      招聘岗位: "救生员、游泳教练员",
    };

    document.getElementById("siteTitle").textContent =
      settings.siteName || "水知晴体育国职模拟考试系统";
    document.getElementById("mainSiteTitle").textContent =
      settings.siteName || "水知晴体育国职模拟考试系统";

    const examInfo = settings.examInfo || defaultExamInfo;
    document.getElementById("examInfo").innerHTML = `
            <p>考试类型：${
              examInfo.考试类型 || "国职游泳救生员（初级/中级/高级）"
            }</p>
            <p>考试时间：${examInfo.考试时间 || "每月第二周周六"}</p>
            <p>考试地点：${examInfo.考试地点 || "各省市体育职业鉴定站"}</p>
            <p>招聘岗位：${examInfo.招聘岗位 || "救生员、游泳教练员"}</p>
        `;

    if (settings.logoUrl) {
      const loginLogo = document.getElementById("loginLogo");
      const mainLogo = document.getElementById("mainLogo");
      const logoPreview = document.getElementById("logoPreview");

      if (loginLogo) loginLogo.src = settings.logoUrl;
      if (mainLogo) mainLogo.src = settings.logoUrl;
      if (logoPreview) logoPreview.src = settings.logoUrl;
    }
  },

  async loadQuestionBank() {
    try {
      const response = await fetch("题库导入模板.csv");
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let csvText;
        const isUTF8 = (bytes) => {
          let i = 0;
          while (i < bytes.length && i < 3) {
            if (
              bytes[i] === 0xef &&
              bytes[i + 1] === 0xbb &&
              bytes[i + 2] === 0xbf
            ) {
              return true;
            }
            i++;
          }
          return false;
        };

        if (isUTF8(uint8Array)) {
          csvText = new TextDecoder("utf-8").decode(uint8Array);
        } else {
          try {
            csvText = new TextDecoder("gbk").decode(uint8Array);
          } catch (e) {
            try {
              csvText = new TextDecoder("gb18030").decode(uint8Array);
            } catch (e2) {
              csvText = new TextDecoder("utf-8", { fatal: false }).decode(
                uint8Array
              );
            }
          }
        }

        const result = await QuestionData.loadFromCSV(
          csvText,
          "国职游泳救生员初级"
        );
        console.log(
          `题库加载完成: 新增${result.new}题, 重复${result.duplicate}题`
        );

        try {
          await Storage.saveQuestions(QuestionData.questions);
        } catch (e) {
          console.warn("保存题库到本地存储失败:", e);
        }
      }
    } catch (e) {
      console.log("题库文件加载失败或不存在，使用空题库");
    }
  },

  loadFontAwesome() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
    document.head.appendChild(link);
  },

  bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.switchLoginTab(e.target.dataset.tab)
      );
    });

    document
      .getElementById("userLoginForm")
      .addEventListener("submit", (e) => this.handleUserLogin(e));
    document
      .getElementById("trialLoginForm")
      .addEventListener("submit", (e) => this.handleTrialLogin(e));
    document
      .getElementById("adminLoginForm")
      .addEventListener("submit", (e) => this.handleAdminLogin(e));

    document.querySelectorAll(".menu-card").forEach((card) => {
      card.addEventListener("click", (e) =>
        this.handleMenuAction(e.currentTarget.dataset.action)
      );
    });

    document
      .getElementById("logoutBtn")
      .addEventListener("click", () => this.logout());

    document
      .getElementById("startExamBtn")
      .addEventListener("click", () => this.startExam(true));
    document
      .getElementById("startPracticeBtn")
      .addEventListener("click", () => this.startExam(false));

    document
      .getElementById("prevQuestion")
      .addEventListener("click", () => this.prevQuestion());
    document
      .getElementById("nextQuestion")
      .addEventListener("click", () => this.nextQuestion());
    document
      .getElementById("skipQuestion")
      .addEventListener("click", () => this.skipQuestion());

    document
      .getElementById("collectBtn")
      .addEventListener("click", () => this.toggleCollect());
    document
      .getElementById("markBtn")
      .addEventListener("click", () => this.toggleMark());

    document
      .getElementById("navToggle")
      .addEventListener("click", () => this.toggleNavPanel());

    document
      .getElementById("submitExam")
      .addEventListener("click", () => this.showSubmitModal());
    document
      .getElementById("saveProgress")
      .addEventListener("click", () => this.saveProgress());

    document
      .getElementById("reviewAnswers")
      .addEventListener("click", () => this.showReview());
    document
      .getElementById("practiceWrong")
      .addEventListener("click", () => this.practiceWrongQuestions());

    document
      .getElementById("practiceAllWrong")
      .addEventListener("click", () => this.practiceWrongQuestions());
    document
      .getElementById("practiceAllFavorites")
      .addEventListener("click", () => this.practiceAllFavorites());

    document.getElementById("includeChoice").addEventListener("change", (e) => {
      document.getElementById("addOptionRow").style.display = e.target.checked
        ? "flex"
        : "none";
    });

    document
      .getElementById("csvFileInput")
      .addEventListener("change", (e) => this.handleCSVImport(e));

    document
      .getElementById("selectAllQuestions")
      .addEventListener("click", () => this.selectAllQuestions());

    document
      .getElementById("batchDeleteQuestions")
      .addEventListener("click", () => this.batchDeleteQuestions());

    document
      .getElementById("clearCategoryQuestions")
      .addEventListener("click", () => this.clearCategoryQuestions());

    document
      .getElementById("clearAllQuestions")
      .addEventListener("click", () => this.clearAllQuestions());

    document
      .getElementById("addQuestionType")
      .addEventListener("change", (e) => {
        document.getElementById("addOptionRow").style.display =
          e.target.value === "单选题" ? "flex" : "none";
      });

    document
      .getElementById("questionProgress")
      .addEventListener("click", () => this.toggleNavPanel());

    if (document.getElementById("logoUpload")) {
      document
        .getElementById("logoUpload")
        .addEventListener("change", (e) => this.handleLogoUpload(e));
    }

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", () => this.closeAllModals());
    });

    window.addEventListener("hashchange", () => this.handleHashChange());
    window.addEventListener("beforeunload", () => this.autoSaveProgress());

    document.addEventListener("keydown", (e) => this.handleKeydown(e));

    if (Utils.isMobile()) {
      this.bindTouchEvents();
    }

    document
      .getElementById("continueProgressBtn")
      .addEventListener("click", () => this.continueProgress());
    document
      .getElementById("discardProgressBtn")
      .addEventListener("click", () => this.discardProgress());

    document
      .getElementById("startPracticeBtn")
      .addEventListener("click", () => this.startExam(false));

    document
      .getElementById("startExamBtn")
      .addEventListener("click", () => this.startExam(true));
  },

  bindTouchEvents() {
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(touchStartX, touchEndX);
    });
  },

  handleSwipe(startX, endX) {
    const threshold = 50;
    const diff = startX - endX;

    if (Math.abs(diff) > threshold) {
      if (
        diff > 0 &&
        this.state.currentQuestionIndex < this.state.questions.length - 1
      ) {
        this.nextQuestion();
      } else if (diff < 0 && this.state.currentQuestionIndex > 0) {
        this.prevQuestion();
      }
    }
  },

  handleKeydown(e) {
    if (this.state.currentPage !== "answer") return;

    switch (e.key) {
      case "ArrowLeft":
        this.prevQuestion();
        break;
      case "ArrowRight":
        this.nextQuestion();
        break;
      case " ":
        e.preventDefault();
        this.skipQuestion();
        break;
      case "1":
        this.selectOption(0);
        break;
      case "2":
        this.selectOption(1);
        break;
      case "3":
        this.selectOption(2);
        break;
      case "4":
        this.selectOption(3);
        break;
    }
  },

  handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash) {
      this.navigateTo(hash);
    }
  },

  navigateTo(page) {
    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.remove("active"));
    const targetPage = document.getElementById(page + "Page");
    if (targetPage) {
      targetPage.classList.add("active");
      this.state.currentPage = page;
    }
  },

  switchLoginTab(tab) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".login-form").forEach((form) => {
      form.classList.remove("active");
    });
    document.getElementById(tab + "LoginForm").classList.add("active");
  },

  async handleUserLogin(e) {
    e.preventDefault();

    const name = document.getElementById("userName").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    const activationCode = document
      .getElementById("activationCode")
      .value.trim();

    if (!name || !phone || !activationCode) {
      Utils.showToast("请填写完整信息", "error");
      return;
    }

    if (!Utils.validatePhone(phone)) {
      Utils.showToast("请输入正确的手机号", "error");
      return;
    }

    const codeValidation = await Storage.validateCode(activationCode);
    if (!codeValidation.valid) {
      Utils.showToast(codeValidation.message, "error");
      return;
    }

    let user = await Storage.getUserByPhone(phone);
    const isFirstLogin = !user;

    if (isFirstLogin) {
      user = {
        phone,
        name,
        registerTime: new Date().toISOString(),
        wrongQuestions: [],
        favorites: [],
      };
      await Storage.saveUser(user);
    } else {
      if (user.name !== name) {
        user.name = name;
        await Storage.saveUser(user);
      }
    }

    await Storage.useCode(activationCode, phone);

    this.state.currentUser = user;
    this.state.isTrial = false;
    Storage.setCurrentUser(this.state.currentUser);

    document.getElementById("loginSuccessMessage").textContent = isFirstLogin
      ? `注册成功！欢迎使用，${name}！`
      : `欢迎回来，${name}！`;
    Utils.showModal("loginConfirmModal");
  },

  handleTrialLogin(e) {
    e.preventDefault();

    this.state.currentUser = {
      phone: "trial_" + Date.now(),
      name: "试用用户",
      isTrial: true,
    };
    this.state.isTrial = true;

    document.getElementById("loginSuccessMessage").textContent =
      "试用登录成功！";
    Utils.showModal("loginConfirmModal");
  },

  confirmLogin() {
    Utils.hideModal("loginConfirmModal");
    this.showMainPage();
    this.updateUserInfo();

    setTimeout(() => {
      document
        .getElementById("mainPage")
        .scrollIntoView({ behavior: "smooth" });
    }, 100);
  },

  async handleAdminLogin(e) {
    e.preventDefault();

    const password = document.getElementById("adminPassword").value;
    const settings = await Storage.getSettings();

    if (password === settings.adminPassword) {
      this.state.currentUser = {
        phone: "admin",
        name: "管理员",
        isAdmin: true,
      };
      Storage.setCurrentUser(this.state.currentUser);
      document.getElementById("adminPassword").value = "";
      await this.showAdminPage();
      setTimeout(() => {
        document
          .getElementById("adminPage")
          .scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      Utils.showToast("密码错误", "error");
    }
  },

  showMainPage() {
    this.navigateTo("main");
    this.updateMenuStats();
    this.checkContinueProgress();
    this.loadProgressRecords();
    this.showLoginSuccessHint();
  },

  showLoginSuccessHint() {
    const hint = document.getElementById("loginSuccessHint");
    const hintText = document.getElementById("loginSuccessText");

    if (this.state.currentUser) {
      if (this.state.currentUser.isTrial) {
        hintText.textContent = "试用登录成功";
      } else if (this.state.currentUser.isAdmin) {
        hintText.textContent = "管理员登录成功";
      } else {
        hintText.textContent = `欢迎，${this.state.currentUser.name}`;
      }
      hint.style.display = "flex";

      setTimeout(() => {
        hint.style.display = "none";
      }, 3000);
    }
  },

  async checkContinueProgress() {
    const progress = await Storage.getTempProgress();
    const banner = document.getElementById("progressBanner");

    if (progress && this.state.currentUser && !this.state.currentUser.isTrial) {
      this.state.savedProgress = progress;
      banner.style.display = "flex";
    } else {
      banner.style.display = "none";
    }
  },

  async showAdminPage() {
    this.navigateTo("admin");
    await this.updateAdminStats();
    this.updateQuestionBankStats();
    await this.loadUserManagement();
    this.loadQuestionBankManagement();
    await this.loadActivationCodeManagement();
  },

  updateUserInfo() {
    const display = document.getElementById("userDisplay");
    if (display && this.state.currentUser) {
      if (this.state.currentUser.isTrial) {
        display.textContent = "试用用户";
      } else if (this.state.currentUser.isAdmin) {
        display.textContent = "管理员";
      } else {
        display.textContent = `${this.state.currentUser.name} (${this.state.currentUser.phone})`;
      }
    }
  },

  async updateMenuStats() {
    if (this.state.isTrial) {
      document.getElementById("wrongCount").parentElement.style.opacity = "0.5";
      document.getElementById("favoriteCount").parentElement.style.opacity =
        "0.5";
      document.getElementById("historyCount").parentElement.style.opacity =
        "0.5";
      return;
    }

    document.getElementById("wrongCount").parentElement.style.opacity = "1";
    document.getElementById("favoriteCount").parentElement.style.opacity = "1";
    document.getElementById("historyCount").parentElement.style.opacity = "1";

    const phone = this.state.currentUser.phone;
    const stats = await Storage.getUserStats(phone);

    const favoriteIds = await Storage.getFavorites(phone);
    const favoriteData = Storage.get(Storage.KEYS.FAVORITE_DATA, {});
    const userFavorites = favoriteData[phone] || {};

    let favoriteCount = 0;
    for (const id of favoriteIds) {
      if (QuestionData.getQuestionById(id) || userFavorites[id]) {
        favoriteCount++;
      }
    }

    document.getElementById(
      "wrongCount"
    ).textContent = `${stats.wrongCount}题待巩固`;
    document.getElementById(
      "favoriteCount"
    ).textContent = `${favoriteCount}题已收藏`;
    document.getElementById(
      "historyCount"
    ).textContent = `${stats.historyCount}次记录`;
  },

  async handleMenuAction(action) {
    if (
      this.state.isTrial &&
      ["wrong", "favorites", "history"].includes(action)
    ) {
      Utils.showToast("试用版无此功能", "warning");
      return;
    }

    switch (action) {
      case "exam":
        this.showExamTypePage();
        break;
      case "practice":
        this.showPracticeTypePage();
        break;
      case "wrong":
        await this.showWrongPage();
        break;
      case "favorites":
        await this.showFavoritePage();
        break;
      case "history":
        await this.showHistoryPage();
        break;
    }
  },

  showExamTypePage() {
    const title = document.getElementById("examTypeTitle");
    title.textContent = "模拟考试";
    this.state.isPracticeType = false;

    document.getElementById("categorySelection").style.display = "block";
    document.getElementById("examSettings").style.display = "none";

    this.navigateTo("examType");
  },

  showPracticeTypePage() {
    const title = document.getElementById("examTypeTitle");
    title.textContent = "刷题练习";
    this.state.isPracticeType = true;

    document.getElementById("categorySelection").style.display = "block";
    document.getElementById("examSettings").style.display = "none";

    this.navigateTo("examType");
  },

  toggleLevels(type, itemId) {
    if (type === "指导员") {
      this.showConstructionAlert("国职游泳指导员");
      return;
    }

    const card = document.querySelector(`#${itemId} .category-card`);
    const drawer = document.querySelector(`#${itemId} .level-drawer`);

    const isOpen = drawer.classList.contains("open");

    document
      .querySelectorAll(".category-card")
      .forEach((c) => c.classList.remove("expanded"));
    document
      .querySelectorAll(".level-drawer")
      .forEach((d) => d.classList.remove("open"));

    if (!isOpen) {
      card.classList.add("expanded");
      drawer.classList.add("open");
    }
  },

  selectCategory(type, level) {
    const category = `国职游泳${type}${level}`;

    if (type === "救生员" && level !== "初级") {
      this.showConstructionAlert(category);
      return;
    }

    if (type === "指导员") {
      this.showConstructionAlert(category);
      return;
    }

    document
      .querySelectorAll(".level-drawer")
      .forEach((d) => d.classList.remove("open"));
    document
      .querySelectorAll(".category-card")
      .forEach((c) => c.classList.remove("expanded"));

    this.state.selectedCategory = category;

    setTimeout(() => {
      document.getElementById("categorySelection").style.display = "none";
      document.getElementById("examSettings").style.display = "block";
      document.getElementById("examInfoBanner").style.display = "flex";
      document
        .getElementById("examInfoBanner")
        .querySelector("span").textContent = `${category}`;

      const practiceModeGroup = document.getElementById("practiceModeGroup");
      const practiceActionButtons = document.getElementById(
        "practiceActionButtons"
      );
      const examActionButtons = document.getElementById("examActionButtons");

      if (this.state.isPracticeType) {
        practiceModeGroup.style.display = "block";
        practiceActionButtons.style.display = "block";
        examActionButtons.style.display = "none";
      } else {
        practiceModeGroup.style.display = "none";
        practiceActionButtons.style.display = "none";
        examActionButtons.style.display = "block";
      }
    }, 300);
  },

  showConstructionAlert(category) {
    document.getElementById("confirmTitle").textContent = "提示";
    document.getElementById("confirmMessage").innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <i class="fa fa-clock-o" style="font-size: 3rem; color: var(--warning-color); margin-bottom: 15px;"></i>
        <p style="font-size: 1.1rem; margin-bottom: 10px;">${category}</p>
        <p style="color: var(--text-secondary);">题库正在建设中，敬请期待！</p>
      </div>
    `;

    const okBtn = document.getElementById("confirmOkBtn");
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.textContent = "返回";
    newOkBtn.className = "btn btn-outline";
    newOkBtn.addEventListener("click", () => {
      this.closeModal("confirmModal");
      document
        .querySelectorAll(".level-drawer")
        .forEach((d) => d.classList.remove("open"));
      document
        .querySelectorAll(".category-card")
        .forEach((c) => c.classList.remove("expanded"));
    });

    this.showModal("confirmModal");
  },

  async startExam(isExam) {
    this.state.isExam = isExam;
    this.state.practiceMode =
      document.querySelector('input[name="practiceMode"]:checked')?.value ||
      "order";
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.markedQuestions = new Set();
    this.state.collectedQuestions = new Set();
    this.state.practiceAnswered = {};
    this.state.practiceCompleted = new Set();

    if (!this.state.isTrial && this.state.currentUser) {
      const favorites = await Storage.getFavorites(
        this.state.currentUser.phone
      );
      favorites.forEach((id) => this.state.collectedQuestions.add(id));
    }

    const types = [];
    if (document.getElementById("includeJudgment").checked)
      types.push("判断题");
    if (document.getElementById("includeChoice").checked) types.push("单选题");

    if (types.length === 0) {
      Utils.showToast("请至少选择一种题型", "error");
      return;
    }

    // 更新顶部提示文字
    const banner = document.getElementById("examInfoBanner");
    if (this.state.isTrial) {
      banner.querySelector(
        "span"
      ).textContent = `${this.state.selectedCategory} - 试用模式：20道题，30分钟，请联系管理员索取激活码使用全功能`;
    } else if (isExam) {
      banner.querySelector(
        "span"
      ).textContent = `${this.state.selectedCategory} - 模拟考试为随机100道题，时间90分钟，考完后展示答案和解析`;
    } else {
      const modeText =
        this.state.practiceMode === "order" ? "顺序练习" : "随机练习";
      banner.querySelector(
        "span"
      ).textContent = `${this.state.selectedCategory} - ${modeText}不限时长，答题后立即展示答案和解析，可保存进度下次继续刷题`;
    }

    let questions;
    if (isExam) {
      questions = QuestionData.getRandomQuestions(100, {
        types: types,
        categories: [this.state.selectedCategory],
      });
    } else {
      const allQuestions = QuestionData.getQuestions({
        types: types,
        categories: [this.state.selectedCategory],
      });
      console.log(`刷题模式：获取到 ${allQuestions.length} 道题目`);

      if (allQuestions.length === 0) {
        Utils.showToast("题库中暂无题目", "error");
        return;
      }

      if (this.state.practiceMode === "order") {
        questions = allQuestions.map((q, i) => ({ ...q, displayIndex: i + 1 }));
      } else {
        questions = QuestionData.getRandomQuestions(allQuestions.length, {
          types: types,
          categories: [this.state.selectedCategory],
        });
      }
    }

    if (questions.length === 0) {
      Utils.showToast("题库中暂无题目", "error");
      return;
    }

    console.log(`开始刷题：共 ${questions.length} 道题`);
    this.state.questions = questions;

    const trialQuestionCount = 20;
    const trialTimeLimit = 30 * 60;

    if (this.state.isTrial) {
      this.state.questions = questions.slice(0, trialQuestionCount);
      this.state.timeRemaining = trialTimeLimit;
    } else {
      this.state.timeRemaining = isExam ? 90 * 60 : 0;
    }

    this.state.startTime = new Date();
    this.state.practiceCompleted = new Set();
    this.state.sourceType = "normal";

    this.navigateTo("answer");
    await this.renderQuestion();
    if (isExam) {
      this.startTimer();
    }
    this.startThinkingTimer();
    await this.updateNavPanel();
    await this.updateNavItemStyles();
  },

  async renderQuestion() {
    const question = this.state.questions[this.state.currentQuestionIndex];
    if (!question) return;

    const isExam = this.state.isExam;
    const totalQuestions = this.state.questions.length;
    const displayTotal = isExam
      ? Math.min(100, totalQuestions)
      : totalQuestions;

    document.getElementById("questionProgress").textContent = `${
      this.state.currentQuestionIndex + 1
    }/${displayTotal}`;

    document.getElementById("questionType").textContent = question.type;
    document.getElementById("questionCategory").textContent = question.category;
    document.getElementById("questionText").textContent = question.question;

    const timeDisplay = document.getElementById("timeDisplay");
    const remainingTime = document.getElementById("remainingTime");
    const thinkingTime = document.querySelector(".thinking-time");

    if (timeDisplay && remainingTime && thinkingTime) {
      if (this.state.isExam) {
        timeDisplay.style.display = "inline-flex";
        remainingTime.parentElement.style.display = "inline-flex";
        thinkingTime.style.display = "block";
      } else {
        timeDisplay.style.display = "none";
        remainingTime.parentElement.style.display = "none";
        thinkingTime.style.display = "block";
      }
    }

    const optionsList = document.getElementById("optionsList");
    optionsList.innerHTML = "";

    const options = [];
    if (question.type === "判断题") {
      options.push({ letter: "A", text: "正确" });
      options.push({ letter: "B", text: "错误" });
    } else {
      if (question.optionA)
        options.push({ letter: "A", text: question.optionA });
      if (question.optionB)
        options.push({ letter: "B", text: question.optionB });
      if (question.optionC)
        options.push({ letter: "C", text: question.optionC });
      if (question.optionD)
        options.push({ letter: "D", text: question.optionD });
    }

    options.forEach((opt, index) => {
      const div = document.createElement("div");
      div.className = "option-item";
      div.dataset.letter = opt.letter;
      div.innerHTML = `
                <span class="option-letter">${opt.letter}</span>
                <span class="option-text">${Utils.escapeHtml(opt.text)}</span>
            `;
      div.addEventListener("click", () => this.selectOption(index));
      optionsList.appendChild(div);
    });

    const answer = this.state.answers[question.id];
    if (answer !== undefined) {
      if (this.state.isExam) {
        this.showExamAnswerState(question, answer);
      } else {
        this.showAnswerFeedback(question, answer);
      }
    } else {
      document.getElementById("answerFeedback").style.display = "none";
    }

    // 刷题模式：恢复已答题目的状态
    if (!this.state.isExam && this.state.practiceCompleted.has(question.id)) {
      const savedAnswer = this.state.answers[question.id];
      if (savedAnswer !== undefined) {
        this.showAnswerFeedback(question, savedAnswer);
      }
    }

    const collectBtn = document.getElementById("collectBtn");
    const isCollected = this.state.collectedQuestions.has(question.id);
    collectBtn.querySelector("i").className = isCollected
      ? "fa fa-star"
      : "fa fa-star-o";

    const markBtn = document.getElementById("markBtn");
    const isMarked = this.state.markedQuestions.has(question.id);
    markBtn.querySelector("i").className = isMarked
      ? "fa fa-flag"
      : "fa fa-flag-o";

    const returnBtn = document.getElementById("returnBtn");
    if (this.state.returnPage) {
      returnBtn.style.display = "inline-flex";
    } else {
      returnBtn.style.display = "none";
    }

    document.getElementById("submitArea").style.display = "flex";

    await this.updateNavItemStyles();
    await this.updateNavPanel();
    this.resetThinkingTimer();
  },

  showExamAnswerState(question, selectedLetter) {
    const options = document.querySelectorAll(".option-item");
    options.forEach((opt, i) => {
      const letter = opt.dataset.letter;
      opt.classList.remove("selected", "correct", "wrong");
      if (letter === selectedLetter) {
        opt.classList.add("selected");
      }
    });
    document.getElementById("answerFeedback").style.display = "none";
  },

  async selectOption(index) {
    const question = this.state.questions[this.state.currentQuestionIndex];
    if (!question) return;

    const options = document.querySelectorAll(".option-item");
    options.forEach((opt, i) => {
      opt.classList.remove("selected", "correct", "wrong");
      if (i === index) {
        opt.classList.add("selected");
      }
    });

    const letters = ["A", "B", "C", "D"];
    const selectedLetter = letters[index];
    this.state.answers[question.id] = selectedLetter;

    if (this.state.isExam) {
      this.showExamAnswerState(question, selectedLetter);
      return;
    }

    this.showAnswerFeedback(question, selectedLetter);
    await this.handlePracticeAnswer(question, selectedLetter);
  },

  showAnswerFeedback(question, selectedLetter) {
    const feedback = document.getElementById("answerFeedback");
    const options = document.querySelectorAll(".option-item");

    const isCorrect = selectedLetter === question.answer;

    options.forEach((opt, i) => {
      const letter = opt.dataset.letter;
      opt.classList.remove("selected", "correct", "wrong");

      if (letter === selectedLetter) {
        opt.classList.add(isCorrect ? "correct" : "wrong");
      }
      if (letter === question.answer) {
        opt.classList.add("correct");
      }
    });

    document.getElementById("correctAnswer").textContent = question.answer;
    document.getElementById("analysisText").textContent =
      question.analysis || "暂无解析";
    feedback.style.display = "block";
  },

  async handlePracticeAnswer(question, selectedLetter) {
    const isCorrect = selectedLetter === question.answer;

    this.state.practiceCompleted.add(question.id);

    if (isCorrect) {
      Utils.showToast("回答正确！", "success");
    } else {
      Utils.showToast("答错，已收录！", "warning");
      if (!this.state.isTrial && this.state.currentUser) {
        Storage.addWrongQuestion(this.state.currentUser.phone, question).catch(
          (e) => console.warn("添加错题失败:", e)
        );
      }
    }

    await this.updateNavItemStyles();
    this.resetThinkingTimer();
  },

  async prevQuestion() {
    if (this.state.currentQuestionIndex > 0) {
      this.state.currentQuestionIndex--;
      await this.renderQuestion();
      await this.updateNavPanel();
    }
  },

  async nextQuestion() {
    if (this.state.currentQuestionIndex < this.state.questions.length - 1) {
      this.state.currentQuestionIndex++;
      await this.renderQuestion();
      await this.updateNavPanel();
    }
  },

  skipQuestion() {
    this.state.answers[
      this.state.questions[this.state.currentQuestionIndex].id
    ] = null;
    this.nextQuestion();
  },

  async toggleCollect() {
    const question = this.state.questions[this.state.currentQuestionIndex];
    if (!question) return;

    if (this.state.collectedQuestions.has(question.id)) {
      this.state.collectedQuestions.delete(question.id);
      if (!this.state.isTrial) {
        Storage.removeFavorite(this.state.currentUser.phone, question.id).catch(
          (e) => console.warn("取消收藏失败:", e)
        );
      }
      Utils.showToast("已取消收藏", "info");
    } else {
      this.state.collectedQuestions.add(question.id);
      if (!this.state.isTrial) {
        Storage.addFavorite(
          this.state.currentUser.phone,
          question.id,
          question
        ).catch((e) => console.warn("添加收藏失败:", e));
      }
      Utils.showToast("收藏成功！", "success");
    }

    await this.renderQuestion();
  },

  async toggleMark() {
    const question = this.state.questions[this.state.currentQuestionIndex];
    if (!question) return;

    if (this.state.markedQuestions.has(question.id)) {
      this.state.markedQuestions.delete(question.id);
      Utils.showToast("已取消标记", "info");
    } else {
      this.state.markedQuestions.add(question.id);
      Utils.showToast("标记成功", "success");
    }

    await this.renderQuestion();
  },

  toggleNavPanel() {
    const panel = document.getElementById("navPanel");
    panel.classList.toggle("active");
  },

  async updateNavPanel() {
    const navGrid = document.getElementById("navGrid");
    const currentCount = this.state.questions.length;
    const sourceType = this.state.sourceType || "normal";
    const needsRebuild =
      navGrid.children.length === 0 ||
      this.state.navQuestionCount !== currentCount ||
      this.state.navSourceType !== sourceType;

    if (needsRebuild) {
      this.state.navQuestionCount = currentCount;
      this.state.navSourceType = sourceType;
      navGrid.innerHTML = "";

      for (let index = 0; index < currentCount; index++) {
        const q = this.state.questions[index];
        const item = document.createElement("div");
        item.className = "nav-item";
        item.dataset.index = index;
        item.innerHTML = `
                  <span class="star-icon"><i class="fa fa-star"></i></span>
                  <span>${q.displayIndex || index + 1}</span>
              `;
        item.addEventListener("click", async () => {
          this.state.currentQuestionIndex = index;
          await this.renderQuestion();
          await this.updateNavPanel();
        });
        navGrid.appendChild(item);
      }
    }

    await this.updateNavItemStyles();

    document.getElementById("answeredCount").textContent = `已答: ${
      Object.keys(this.state.answers).filter(
        (k) => this.state.answers[k] !== null
      ).length
    }`;
  },

  async updateNavItemStyles() {
    const items = document.querySelectorAll(".nav-item");
    const isExam = this.state.isExam;

    let userFavorites = [];
    if (this.state.currentUser && !this.state.isTrial) {
      userFavorites = await Storage.getFavorites(this.state.currentUser.phone);
    }

    items.forEach((item, index) => {
      item.classList.remove(
        "current",
        "correct",
        "wrong",
        "marked",
        "collected"
      );

      if (!this.state.questions[index]) return;

      const qId = this.state.questions[index].id;
      const answer = this.state.answers[qId];

      if (index === this.state.currentQuestionIndex) {
        item.classList.add("current");
      } else if (!isExam && answer === this.state.questions[index].answer) {
        item.classList.add("correct");
      } else if (!isExam && answer) {
        item.classList.add("wrong");
      }

      if (this.state.markedQuestions.has(qId)) {
        item.classList.add("marked");
      }

      if (
        this.state.collectedQuestions.has(qId) ||
        userFavorites.includes(qId)
      ) {
        item.classList.add("collected");
      }
    });
  },

  startTimer() {
    this.stopTimer();
    this.state.timerInterval = setInterval(() => {
      this.state.timeRemaining--;
      this.updateTimeDisplay();

      if (this.state.timeRemaining <= 0) {
        this.stopTimer();
        if (this.state.isTrial) {
          this.handleTrialTimeUp();
        } else {
          this.autoSubmit();
        }
      }
    }, 1000);
  },

  handleTrialTimeUp() {
    document.getElementById("confirmTitle").textContent = "试用时间已到";
    document.getElementById("confirmMessage").innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <i class="fa fa-clock-o" style="font-size: 3rem; color: var(--warning-color); margin-bottom: 15px;"></i>
        <p style="font-size: 1.1rem; margin-bottom: 10px;">试用时间已到</p>
        <p style="color: var(--text-secondary);">请联系管理员索取激活码<br>激活后可使用全功能</p>
      </div>
    `;

    const okBtn = document.getElementById("confirmOkBtn");
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.textContent = "返回登录";
    newOkBtn.className = "btn btn-primary";
    newOkBtn.addEventListener("click", () => {
      this.closeModal("confirmModal");
      this.logout();
    });

    Utils.showModal("confirmModal");
  },

  stopTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  stopThinkingTimer() {
    if (this.state.thinkingTimer) {
      clearInterval(this.state.thinkingTimer);
      this.state.thinkingTimer = null;
    }
  },

  returnToSource() {
    this.stopTimer();
    this.stopThinkingTimer();
    const returnPage = this.state.returnPage;
    this.state.returnPage = null;
    if (returnPage === "wrong") {
      this.showWrongPage();
    } else if (returnPage === "favorites") {
      this.showFavoritePage();
    } else {
      this.navigateTo("main");
    }
  },

  updateTimeDisplay() {
    const display = document.getElementById("remainingTime");
    const badge = document.getElementById("timeDisplay");

    display.textContent = Utils.formatTime(this.state.timeRemaining);

    badge.classList.remove("warning", "safe");
    if (this.state.timeRemaining <= 300) {
      badge.classList.add("warning");
    } else if (this.state.timeRemaining <= 600) {
      badge.classList.add("safe");
    }
  },

  startThinkingTimer() {
    this.stopThinkingTimer();
    this.state.thinkingSeconds = 0;
    this.state.thinkingTimer = setInterval(() => {
      this.state.thinkingSeconds++;
      const secs = this.state.thinkingSeconds % 60;
      const mins = Math.floor(this.state.thinkingSeconds / 60);
      const timerDisplay = document.getElementById("thinkingTimer");
      if (timerDisplay) {
        timerDisplay.textContent = `${mins.toString().padStart(2, "0")}:${secs
          .toString()
          .padStart(2, "0")}`;
      }
    }, 1000);
  },

  stopThinkingTimer() {
    if (this.state.thinkingTimer) {
      clearInterval(this.state.thinkingTimer);
      this.state.thinkingTimer = null;
    }
  },

  resetThinkingTimer() {
    this.state.thinkingSeconds = 0;
    document.getElementById("thinkingTimer").textContent = "00:00";
  },

  autoSubmit() {
    Utils.showToast("时间到，自动交卷", "warning");
    this.submitExam();
  },

  showSubmitModal() {
    const answered = Object.keys(this.state.answers).filter(
      (k) => this.state.answers[k] !== null
    ).length;
    document.getElementById("answeredForSubmit").textContent = answered;
    Utils.showModal("submitModal");
  },

  confirmSubmit() {
    this.stopTimer();
    this.stopThinkingTimer();
    this.submitExam();
  },

  submitExam() {
    Utils.closeAllModals();

    let correctCount = 0;
    let wrongCount = 0;
    const wrongQuestions = [];

    this.state.questions.forEach((q) => {
      const answer = this.state.answers[q.id];
      if (answer === q.answer) {
        correctCount++;
      } else if (answer) {
        wrongCount++;
        wrongQuestions.push({
          ...q,
          userAnswer: answer,
        });
      }
    });

    const totalQuestions = this.state.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const timeUsed = this.state.startTime
      ? Math.floor(
          (Date.now() - new Date(this.state.startTime).getTime()) / 1000
        )
      : 0;
    const avgTime = Math.round(timeUsed / totalQuestions);

    const result = {
      id: Utils.generateId(),
      date: new Date().toISOString(),
      totalQuestions,
      correctCount,
      wrongCount,
      score,
      timeUsed,
      avgTime,
      mode: this.state.isExam ? "模拟考试" : "刷题练习",
      categoryName: this.state.selectedCategory || "未分类",
      sourceType: this.state.sourceType || "normal",
      isTrial: this.state.isTrial,
      questions: this.state.questions.map((q) => ({
        ...q,
        userAnswer: this.state.answers[q.id],
      })),
    };

    if (!this.state.isTrial) {
      Storage.saveHistory(this.state.currentUser.phone, result).catch((e) =>
        console.warn("保存历史记录失败:", e)
      );
      if (this.state.isExam) {
        wrongQuestions.forEach((q) => {
          Storage.addWrongQuestion(this.state.currentUser.phone, q).catch((e) =>
            console.warn("添加错题失败:", e)
          );
        });
      }
    }

    this.state.savedProgress = null;

    this.showResultPage(result);
  },

  showResultPage(result) {
    this.navigateTo("result");

    document.getElementById("finalScore").textContent = result.score;

    const status = document.getElementById("scoreStatus");
    status.textContent = result.score >= 60 ? "及格" : "不及格";
    status.className = `score-status ${result.score >= 60 ? "pass" : "fail"}`;

    const circle = document.getElementById("scoreCircle");
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (result.score / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    document.getElementById("totalQuestions").textContent =
      result.totalQuestions;
    document.getElementById("correctQuestions").textContent =
      result.correctCount;
    document.getElementById("wrongQuestions").textContent = result.wrongCount;
    document.getElementById("accuracy").textContent =
      Math.round((result.correctCount / result.totalQuestions) * 100) + "%";
    document.getElementById("timeUsed").textContent = Utils.formatTime(
      result.timeUsed
    );
    document.getElementById("avgTime").textContent = result.avgTime + "秒";
  },

  showReview() {
    const result = {
      questions: this.state.questions.map((q) => ({
        ...q,
        userAnswer: this.state.answers[q.id],
      })),
    };

    const container = document.getElementById("reviewContainer");
    container.innerHTML = "";

    result.questions.forEach((q) => {
      const isCorrect = q.userAnswer === q.answer;
      const div = document.createElement("div");
      div.className = `review-item ${isCorrect ? "correct" : "wrong"}`;

      const options = [];
      if (q.type === "判断题") {
        options.push({ letter: "A", text: "正确" });
        options.push({ letter: "B", text: "错误" });
      } else {
        if (q.optionA) options.push({ letter: "A", text: q.optionA });
        if (q.optionB) options.push({ letter: "B", text: q.optionB });
        if (q.optionC) options.push({ letter: "C", text: q.optionC });
        if (q.optionD) options.push({ letter: "D", text: q.optionD });
      }

      div.innerHTML = `
                <div class="review-question-header">
                    <span class="type-badge">${q.type}</span>
                    <span class="review-result ${
                      isCorrect ? "correct" : "wrong"
                    }">
                        <i class="fa ${
                          isCorrect ? "fa-check-circle" : "fa-times-circle"
                        }"></i>
                        ${isCorrect ? "正确" : "错误"}
                    </span>
                </div>
                <div class="review-question">${Utils.escapeHtml(
                  q.question
                )}</div>
                <div class="review-options">
                    ${options
                      .map(
                        (opt) => `
                        <div class="review-option ${
                          opt.letter === q.answer ? "correct-answer" : ""
                        } ${
                          opt.letter === q.userAnswer &&
                          q.userAnswer !== q.answer
                            ? "selected-wrong"
                            : ""
                        }">
                            <span class="review-letter">${opt.letter}</span>
                            <span>${Utils.escapeHtml(opt.text)}</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
                ${
                  q.analysis
                    ? `
                    <div class="review-analysis">
                        <h4>解析</h4>
                        <p>${Utils.escapeHtml(q.analysis)}</p>
                    </div>
                `
                    : ""
                }
            `;
      container.appendChild(div);
    });

    this.navigateTo("review");
  },

  async practiceWrongQuestions() {
    if (this.state.isTrial) {
      Utils.showToast("试用版无此功能", "warning");
      return;
    }

    const wrongQuestions = await Storage.getWrongQuestions(
      this.state.currentUser.phone
    );
    console.log("错题数量:", wrongQuestions.length);
    console.log("第一道错题:", wrongQuestions[0]);
    if (wrongQuestions.length === 0) {
      Utils.showToast("暂无错题", "info");
      return;
    }

    const questions = wrongQuestions.map((q, i) => ({
      ...q,
      displayIndex: i + 1,
    }));
    console.log("questions:", questions);

    this.state.questions = questions;
    this.state.timeRemaining = questions.length * 60;
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.practiceCompleted = new Set();
    this.state.startTime = new Date();
    this.state.isExam = false;
    this.state.sourceType = "wrong";
    this.state.returnPage = "wrong";

    this.navigateTo("answer");
    await this.renderQuestion();
    this.startTimer();
    this.startThinkingTimer();
    await this.updateNavPanel();
  },

  async showWrongPage() {
    if (this.state.isTrial) {
      Utils.showToast("试用版无此功能", "warning");
      return;
    }

    const wrongQuestions = await Storage.getWrongQuestions(
      this.state.currentUser.phone
    );
    const totalWrong = wrongQuestions.length;

    document.getElementById("totalWrong").textContent = totalWrong;
    document.getElementById("practiceCount").textContent =
      wrongQuestions.reduce((sum, q) => sum + (q.wrongCount || 0), 0);

    const list = document.getElementById("wrongList");
    list.innerHTML = "";

    if (wrongQuestions.length === 0) {
      list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <i class="fa fa-check-circle" style="font-size: 4rem; color: var(--success-color); margin-bottom: 20px;"></i>
                    <p>太棒了！暂无错题</p>
                </div>
            `;
    } else {
      wrongQuestions.forEach((q, index) => {
        let optionsHtml = "";
        if (q.type === "判断题") {
          optionsHtml = `
            <div class="review-option ${
              q.answer === "对" || q.answer === "正确" ? "correct" : ""
            }">√ 正确</div>
            <div class="review-option ${
              q.answer === "错" || q.answer === "错误" ? "correct" : ""
            }">× 错误</div>
          `;
        } else {
          const optA = q.optionA || q.a || "";
          const optB = q.optionB || q.b || "";
          const optC = q.optionC || q.c || "";
          const optD = q.optionD || q.d || "";
          optionsHtml = [
            optA
              ? `<div class="review-option ${
                  "A" === q.answer ? "correct" : ""
                }">A. ${optA}</div>`
              : "",
            optB
              ? `<div class="review-option ${
                  "B" === q.answer ? "correct" : ""
                }">B. ${optB}</div>`
              : "",
            optC
              ? `<div class="review-option ${
                  "C" === q.answer ? "correct" : ""
                }">C. ${optC}</div>`
              : "",
            optD
              ? `<div class="review-option ${
                  "D" === q.answer ? "correct" : ""
                }">D. ${optD}</div>`
              : "",
          ].join("");
        }

        const div = document.createElement("div");
        div.className = "wrong-item";
        div.dataset.id = q.id;
        div.innerHTML = `
                    <div class="wrong-item-main">
                        <span class="wrong-index">${index + 1}</span>
                        <div class="wrong-content">
                            <h4>${Utils.truncateText(q.question, 80)}</h4>
                            <div class="wrong-meta">
                                <span><i class="fa fa-times"></i> 错${
                                  q.wrongCount || 1
                                }次</span>
                                <span>${q.category}</span>
                            </div>
                            <div class="wrong-item-actions">
                                <button class="btn btn-xs btn-primary" onclick="App.practiceSingleWrong(${
                                  q.id
                                })"><i class="fa fa-play"></i> 练习</button>
                                <button class="btn btn-xs btn-outline" onclick="App.deleteWrongQuestion(${
                                  q.id
                                })"><i class="fa fa-trash"></i> 删除</button>
                                <button class="btn btn-xs btn-outline toggle-analysis-btn" onclick="App.toggleAnalysis(this, event)">
                                    <i class="fa fa-eye"></i> <span class="btn-text">查看</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="answer-drawer" style="display: none;">
                        <div class="answer-content">
                            <div class="correct-answer">
                                <i class="fa fa-check-circle"></i>
                                正确答案：${q.answer}
                            </div>
                            <div class="options-list">
                                ${optionsHtml}
                            </div>
                            ${
                              q.analysis
                                ? `<div class="answer-analysis"><strong>解析：</strong>${q.analysis}</div>`
                                : ""
                            }
                        </div>
                    </div>
                `;
        list.appendChild(div);
      });
    }

    document.getElementById("toggleAllAnswers").onclick = () =>
      this.toggleAllAnswerDrawers("wrongList");
    document.getElementById("practiceAllWrong").onclick = () =>
      this.practiceWrongQuestions();

    this.navigateTo("wrong");
  },

  toggleAnalysis(btn, event) {
    if (event) event.stopPropagation();
    const item = btn.closest(".wrong-item, .favorite-item");
    const drawer = item.querySelector(".answer-drawer");
    const btnText = btn.querySelector(".btn-text");
    const isHidden = drawer.style.display === "none";
    drawer.style.display = isHidden ? "block" : "none";
    btnText.textContent = isHidden ? "收起" : "查看";
    btn.classList.toggle("btn-primary", !isHidden);
    btn.classList.toggle("btn-outline", isHidden);
    const icon = btn.querySelector("i");
    icon.className = isHidden ? "fa fa-chevron-up" : "fa fa-eye";
  },

  toggleAllAnswerDrawers(listId) {
    const list = document.getElementById(listId);
    const drawers = list.querySelectorAll(".answer-drawer");
    const firstDrawer = drawers[0];
    const isHidden = firstDrawer.style.display === "none";

    drawers.forEach((drawer) => {
      drawer.style.display = isHidden ? "block" : "none";
    });

    const btns = list.querySelectorAll(".toggle-analysis-btn");
    btns.forEach((btn) => {
      const btnText = btn.querySelector(".btn-text");
      btnText.textContent = isHidden ? "收起" : "查看";
      btn.classList.toggle("btn-primary", !isHidden);
      btn.classList.toggle("btn-outline", isHidden);
      const icon = btn.querySelector("i");
      icon.className = isHidden ? "fa fa-chevron-up" : "fa fa-eye";
    });

    const toggleBtn = list
      .closest(".page")
      .querySelector("#toggleAllAnswers, #toggleAllFavoriteAnswers");
    if (toggleBtn) {
      const btnText = toggleBtn.querySelector("span") || toggleBtn;
      const btnIcon = toggleBtn.querySelector("i");
      if (isHidden) {
        btnIcon.className = "fa fa-eye-slash";
        toggleBtn.innerHTML = `<i class="fa fa-eye-slash"></i> 一键收起答案`;
      } else {
        btnIcon.className = "fa fa-eye";
        toggleBtn.innerHTML = `<i class="fa fa-eye"></i> 一键查看答案`;
      }
    }

    Utils.showToast(isHidden ? "已展开所有答案" : "已收起所有答案", "info");
  },

  async deleteWrongQuestion(questionId) {
    if (!confirm("确定要删除这道错题吗？")) return;
    await Storage.removeWrongQuestion(this.state.currentUser.phone, questionId);
    Utils.showToast("已删除", "success");
    this.showWrongPage();
    this.updateMenuStats();
  },

  async clearAllWrongQuestions() {
    if (!confirm("确定要清空所有错题吗？此操作不可恢复。")) return;
    await Storage.clearWrongQuestions(this.state.currentUser.phone);
    Utils.showToast("已清空所有错题", "success");
    this.showWrongPage();
    this.updateMenuStats();
  },

  async clearAllFavorites() {
    if (!confirm("确定要清空所有收藏吗？此操作不可恢复。")) return;
    Storage.clearFavorites(this.state.currentUser.phone);
    Utils.showToast("已清空所有收藏", "success");
    this.showFavoritePage();
    this.updateMenuStats();
  },

  async clearAllHistory() {
    if (!confirm("确定要清空所有历史记录吗？此操作不可恢复。")) return;
    await Storage.clearHistory(this.state.currentUser.phone);
    Utils.showToast("已清空所有历史", "success");
    this.showHistoryPage();
    this.updateMenuStats();
  },

  deleteHistory(date) {
    if (!confirm("确定要删除这条历史记录吗？")) return;
    Storage.removeHistory(this.state.currentUser.phone, date);
    Utils.showToast("已删除", "success");
    this.showHistoryPage();
    this.updateMenuStats();
  },

  async practiceSingleWrong(questionId) {
    const wrongQuestions = await Storage.getWrongQuestions(
      this.state.currentUser.phone
    );
    const question = wrongQuestions.find((q) => q.id === questionId);

    if (!question) return;

    this.state.questions = [{ ...question, displayIndex: 1 }];
    this.state.timeRemaining = 60;
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.startTime = new Date();
    this.state.isExam = false;

    this.navigateTo("answer");
    await this.renderQuestion();
    this.startTimer();
    this.startThinkingTimer();
    await this.updateNavPanel();
  },

  async showFavoritePage() {
    if (this.state.isTrial) {
      Utils.showToast("试用版无此功能", "warning");
      return;
    }

    if (!QuestionData.isLoaded()) {
      Utils.showToast("题库正在加载中，请稍候...", "warning");
      return;
    }

    const favoriteIds = await Storage.getFavorites(
      this.state.currentUser.phone
    );
    let groupedFavorites = await Storage.getFavoritesByCategory(
      this.state.currentUser.phone
    );

    let totalFound = Object.values(groupedFavorites).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    if (totalFound === 0 && favoriteIds.length > 0) {
      const favoriteData = Storage.get(Storage.KEYS.FAVORITE_DATA, {});
      const userFavorites = favoriteData[this.state.currentUser.phone] || {};
      groupedFavorites = {};
      favoriteIds.forEach((id) => {
        const q = userFavorites[id];
        if (q) {
          if (!groupedFavorites[q.category]) {
            groupedFavorites[q.category] = [];
          }
          groupedFavorites[q.category].push(q);
        }
      });
      totalFound = favoriteIds.length;
    }

    const categories = Object.keys(groupedFavorites).sort();

    const categoryTabs = document.getElementById("favoriteCategoryTabs");
    categoryTabs.innerHTML = `
            <button class="cat-tab active" data-category="all">全部</button>
            ${categories
              .map(
                (cat) => `
                <button class="cat-tab" data-category="${cat}">${cat}</button>
            `
              )
              .join("")}
        `;

    const allSubCategories = new Set();
    Object.values(groupedFavorites).forEach((arr) => {
      arr.forEach((q) => {
        if (q.subCategory) {
          allSubCategories.add(q.subCategory);
        }
      });
    });
    const subCategories = Array.from(allSubCategories).sort();

    const subCategoryTabs = document.getElementById("favoriteSubCategoryTabs");
    subCategoryTabs.innerHTML = `
            <button class="subcat-tab active" data-subcategory="all">全部</button>
            ${subCategories
              .map(
                (subCat) => `
                <button class="subcat-tab" data-subcategory="${subCat}">${subCat}</button>
            `
              )
              .join("")}
        `;

    document.getElementById("totalFavorites").textContent = totalFound;
    document.getElementById("totalCategories").textContent = categories.length;
    document.getElementById("totalSubCategories").textContent =
      subCategories.length;

    if (totalFound === 0 && favoriteIds.length > 0) {
      document.getElementById("totalFavorites").textContent = "0";
    }

    categoryTabs.querySelectorAll(".cat-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        categoryTabs
          .querySelectorAll(".cat-tab")
          .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        const selectedCategory = e.target.dataset.category;
        this.updateFavoritesSubCategories(selectedCategory, groupedFavorites);
        this.renderFavoriteList(
          selectedCategory,
          document.querySelector(".subcat-tab.active")?.dataset.subcategory ||
            "all",
          groupedFavorites
        );
      });
    });

    subCategoryTabs.querySelectorAll(".subcat-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        subCategoryTabs
          .querySelectorAll(".subcat-tab")
          .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        const selectedCategory =
          categoryTabs.querySelector(".cat-tab.active")?.dataset.category ||
          "all";
        this.renderFavoriteList(
          selectedCategory,
          e.target.dataset.subcategory,
          groupedFavorites
        );
      });
    });

    this.renderFavoriteList("all", "all", groupedFavorites);

    document.getElementById("toggleAllFavoriteAnswers").onclick = () =>
      this.toggleAllAnswerDrawers("favoriteList");

    this.navigateTo("favorite");
  },

  updateFavoritesSubCategories(category, grouped) {
    const subCategoryTabs = document.getElementById("favoriteSubCategoryTabs");
    const allSubCategories = new Set();

    if (category === "all") {
      Object.values(grouped).forEach((arr) => {
        arr.forEach((q) => {
          if (q.subCategory) {
            allSubCategories.add(q.subCategory);
          }
        });
      });
    } else {
      (grouped[category] || []).forEach((q) => {
        if (q.subCategory) {
          allSubCategories.add(q.subCategory);
        }
      });
    }

    const subCategories = Array.from(allSubCategories).sort();
    subCategoryTabs.innerHTML = `
            <button class="subcat-tab active" data-subcategory="all">全部</button>
            ${subCategories
              .map(
                (subCat) => `
                <button class="subcat-tab" data-subcategory="${subCat}">${subCat}</button>
            `
              )
              .join("")}
        `;

    subCategoryTabs.querySelectorAll(".subcat-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        subCategoryTabs
          .querySelectorAll(".subcat-tab")
          .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        const selectedCategory =
          document.querySelector(".cat-tab.active")?.dataset.category || "all";
        this.renderFavoriteList(
          selectedCategory,
          e.target.dataset.subcategory,
          grouped
        );
      });
    });
  },

  renderFavoriteList(category, subCategory, grouped) {
    const list = document.getElementById("favoriteList");
    list.innerHTML = "";

    let favorites = [];
    if (category === "all") {
      Object.values(grouped).forEach((arr) => favorites.push(...arr));
    } else {
      favorites = grouped[category] || [];
    }

    if (subCategory !== "all") {
      favorites = favorites.filter((q) => q.subCategory === subCategory);
    }

    if (favorites.length === 0) {
      list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <i class="fa fa-star-o" style="font-size: 4rem; color: var(--text-light); margin-bottom: 20px;"></i>
                    <p>暂无收藏题目</p>
                </div>
            `;
      return;
    }

    favorites.forEach((q, index) => {
      console.log(
        "收藏题目数据:",
        q.id,
        q.type,
        q.optionA,
        q.optionB,
        q.optionC,
        q.optionD,
        q.a,
        q.b,
        q.c,
        q.d
      );

      let optionsHtml = "";
      if (q.type === "判断题") {
        optionsHtml = `
          <div class="review-option ${
            q.answer === "对" || q.answer === "正确" ? "correct" : ""
          }">√ 正确</div>
          <div class="review-option ${
            q.answer === "错" || q.answer === "错误" ? "correct" : ""
          }">× 错误</div>
        `;
      } else {
        const options = [];
        const optA = q.optionA || q.a || "";
        const optB = q.optionB || q.b || "";
        const optC = q.optionC || q.c || "";
        const optD = q.optionD || q.d || "";
        if (optA) options.push({ letter: "A", text: optA });
        if (optB) options.push({ letter: "B", text: optB });
        if (optC) options.push({ letter: "C", text: optC });
        if (optD) options.push({ letter: "D", text: optD });
        optionsHtml = options
          .map(
            (opt) =>
              `<div class="review-option ${
                opt.letter === q.answer ? "correct" : ""
              }">${opt.letter}. ${opt.text}</div>`
          )
          .join("");
      }

      const div = document.createElement("div");
      div.className = "question-card favorite-item";
      div.dataset.id = q.id;
      div.innerHTML = `
                <div class="question-content">
                    <div class="question-header">
                        <span class="type-badge">${q.type}</span>
                        <span class="category-tag">${q.category}</span>
                        <span class="subcategory-tag">${
                          q.subCategory || "基础常识"
                        }</span>
                        <div class="question-footer">
                            <button class="btn btn-xs btn-primary" onclick="App.practiceSingleFavorite(${
                              q.id
                            })"><i class="fa fa-play"></i> 练习</button>
                            <button class="btn btn-xs btn-outline" onclick="App.removeFavorite(${
                              q.id
                            })"><i class="fa fa-star"></i> 取消</button>
                            <button class="btn btn-xs btn-outline toggle-analysis-btn" onclick="App.toggleAnalysis(this, event)">
                                <i class="fa fa-eye"></i> <span class="btn-text">查看</span>
                            </button>
                        </div>
                    </div>
                    <div class="question-body">
                        <p class="question-text">${Utils.escapeHtml(
                          q.question
                        )}</p>
                    </div>
                    <div class="answer-drawer" style="display: none;">
                        <div class="answer-content">
                            <div class="correct-answer">
                                <i class="fa fa-check-circle"></i>
                                正确答案：${q.answer}
                            </div>
                            <div class="options-list">
                                ${optionsHtml}
                            </div>
                            ${
                              q.analysis
                                ? `<div class="answer-analysis"><strong>解析：</strong>${q.analysis}</div>`
                                : ""
                            }
                        </div>
                    </div>
                </div>
            `;
      list.appendChild(div);
    });
  },

  async practiceSingleFavorite(questionId) {
    const favorites = await Storage.getFavorites(this.state.currentUser.phone);
    let question = QuestionData.getQuestionById(questionId);

    if (!question) {
      const favoriteData = Storage.get(Storage.KEYS.FAVORITE_DATA, {});
      const userFavorites = favoriteData[this.state.currentUser.phone] || {};
      question = userFavorites[questionId];
    }

    if (!question) {
      Utils.showToast("题目数据不存在", "warning");
      return;
    }

    this.state.questions = [{ ...question, displayIndex: 1 }];
    this.state.timeRemaining = 60;
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.practiceCompleted = new Set();
    this.state.startTime = new Date();
    this.state.isExam = false;
    this.state.returnPage = "favorites";

    this.navigateTo("answer");
    await this.renderQuestion();
    this.startTimer();
    this.startThinkingTimer();
    await this.updateNavPanel();
  },

  removeFavorite(questionId) {
    Storage.removeFavorite(this.state.currentUser.phone, questionId);
    Utils.showToast("已取消收藏", "info");
    this.showFavoritePage();
    this.updateMenuStats();
  },

  async practiceAllFavorites() {
    const favorites = await Storage.getFavorites(this.state.currentUser.phone);
    if (favorites.length === 0) {
      Utils.showToast("暂无收藏", "info");
      return;
    }

    const favoriteData = Storage.get(Storage.KEYS.FAVORITE_DATA, {});
    const userFavorites = favoriteData[this.state.currentUser.phone] || {};

    const rawQuestions = favorites
      .map((id) => {
        let q = QuestionData.getQuestionById(id);
        if (!q && userFavorites[id]) {
          q = userFavorites[id];
        }
        return q ? { ...q } : null;
      })
      .filter((q) => q);

    if (rawQuestions.length === 0) {
      Utils.showToast("收藏的题目不存在", "error");
      return;
    }

    const questions = rawQuestions.map((q, i) => ({
      ...q,
      displayIndex: i + 1,
    }));

    this.state.questions = questions;
    this.state.timeRemaining = questions.length * 60;
    this.state.currentQuestionIndex = 0;
    this.state.answers = {};
    this.state.practiceCompleted = new Set();
    this.state.startTime = new Date();
    this.state.isExam = false;
    this.state.sourceType = "favorite";
    this.state.returnPage = "favorites";

    this.navigateTo("answer");
    await this.renderQuestion();
    this.startTimer();
    this.startThinkingTimer();
    await this.updateNavPanel();
  },

  async showHistoryPage() {
    if (this.state.isTrial) {
      Utils.showToast("试用版无历史记录", "warning");
      return;
    }

    const history = await Storage.getHistory(this.state.currentUser.phone);
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    if (history.length === 0) {
      list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <i class="fa fa-history" style="font-size: 4rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                    <p>暂无历史记录</p>
                </div>
            `;
    } else {
      history.forEach((item) => {
        const modeName = item.mode || "刷题练习";
        const sourceType = item.sourceType || "normal";

        let title = modeName;
        let categoryName = item.categoryName || "";

        if (sourceType === "wrong") {
          title = "错题练习";
          categoryName = "错题集";
        } else if (sourceType === "favorite") {
          title = "收藏练习";
          categoryName = "收藏夹";
        } else if (
          !categoryName &&
          item.questions &&
          item.questions.length > 0
        ) {
          categoryName = item.questions[0].category || "国职游泳救生员初级";
        } else if (!categoryName) {
          categoryName = "国职游泳救生员初级";
        }

        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
                    <div class="history-header">
                        <span class="history-date">${Utils.formatDate(
                          item.date
                        )}</span>
                        <span class="history-status ${
                          item.score >= 60 ? "completed" : "incomplete"
                        }">
                            ${item.score >= 60 ? "及格" : "不及格"}
                        </span>
                    </div>
                    <div class="history-title">
                        <i class="fa fa-bookmark"></i> ${title} - ${categoryName}
                    </div>
                    <div class="history-stats">
                        <div class="history-stat">
                            <span class="history-stat-value">${
                              item.totalQuestions
                            }</span>
                            <span class="history-stat-label">总题数</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${
                              item.correctCount
                            }</span>
                            <span class="history-stat-label">正确</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${
                              item.timeUsed
                                ? Utils.formatTime(item.timeUsed)
                                : "-"
                            }</span>
                            <span class="history-stat-label">用时</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${
                              item.score
                            }%</span>
                            <span class="history-stat-label">得分</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn danger" onclick="App.deleteHistory('${
                          item.date
                        }')" title="删除">
                            <i class="fa fa-trash"></i>
                        </button>
                        <button class="history-action-btn primary" onclick="App.showHistoryDetail('${
                          item.date
                        }')">查看详情</button>
                        <button class="history-action-btn secondary" onclick="App.reviewHistory('${
                          item.date
                        }')">回顾答案</button>
                    </div>
                `;
        list.appendChild(div);
      });
    }

    this.navigateTo("history");
  },

  async showHistoryDetail(date) {
    const history = await Storage.getHistory(this.state.currentUser.phone);
    const item = history.find((h) => h.date === date);

    if (!item) {
      Utils.showToast("该记录不存在或已删除", "warning");
      return;
    }

    const modeName = item.mode || "刷题练习";
    const sourceType = item.sourceType || "normal";
    let title = modeName;
    let categoryName = item.categoryName || "";

    if (sourceType === "wrong") {
      title = "错题练习";
      categoryName = "错题集";
    } else if (sourceType === "favorite") {
      title = "收藏练习";
      categoryName = "收藏夹";
    } else if (!categoryName && item.questions && item.questions.length > 0) {
      categoryName = item.questions[0].category || "国职游泳救生员初级";
    } else if (!categoryName) {
      categoryName = "国职游泳救生员初级";
    }

    const content = document.getElementById("historyDetailContent");
    content.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">
                    <i class="fa fa-bookmark"></i> ${title} - ${categoryName}
                </div>
                <div style="font-size: 3rem; font-weight: 700; color: ${
                  item.score >= 60
                    ? "var(--success-color)"
                    : "var(--danger-color)"
                };">
                    ${item.score}
                </div>
                <div style="color: var(--text-secondary);">得分</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 600;">${
                      item.totalQuestions
                    }</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">总题数</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 600;">${
                      item.correctCount
                    }</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">正确数</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 600;">${
                      item.timeUsed ? Utils.formatTime(item.timeUsed) : "-"
                    }</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">总用时</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 1.5rem; font-weight: 600;">${
                      item.avgTime || 0
                    }秒</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">平均每题</div>
                </div>
            </div>
            <div style="text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa fa-calendar"></i> ${Utils.formatDate(item.date)}
            </div>
        `;

    document.getElementById("viewHistoryAnswers").onclick = () => {
      this.closeModal("historyDetailModal");
      this.reviewHistory(date);
    };

    Utils.showModal("historyDetailModal");
  },

  async reviewHistory(date) {
    const history = await Storage.getHistory(this.state.currentUser.phone);
    const item = history.find((h) => h.date === date);

    const container = document.getElementById("reviewContainer");
    container.innerHTML = "";

    item.questions.forEach((q) => {
      const isCorrect = q.userAnswer === q.answer;
      const div = document.createElement("div");
      div.className = `review-item ${isCorrect ? "correct" : "wrong"}`;

      const options = [];
      if (q.type === "判断题") {
        options.push({ letter: "A", text: "正确" });
        options.push({ letter: "B", text: "错误" });
      } else {
        if (q.optionA) options.push({ letter: "A", text: q.optionA });
        if (q.optionB) options.push({ letter: "B", text: q.optionB });
        if (q.optionC) options.push({ letter: "C", text: q.optionC });
        if (q.optionD) options.push({ letter: "D", text: q.optionD });
      }

      div.innerHTML = `
                <div class="review-question-header">
                    <span class="type-badge">${q.type}</span>
                    <span class="review-result ${
                      isCorrect ? "correct" : "wrong"
                    }">
                        <i class="fa ${
                          isCorrect ? "fa-check-circle" : "fa-times-circle"
                        }"></i>
                        ${isCorrect ? "正确" : "错误"}
                    </span>
                </div>
                <div class="review-question">${Utils.escapeHtml(
                  q.question
                )}</div>
                <div class="review-options">
                    ${options
                      .map(
                        (opt) => `
                        <div class="review-option ${
                          opt.letter === q.answer ? "correct-answer" : ""
                        } ${
                          opt.letter === q.userAnswer &&
                          q.userAnswer !== q.answer
                            ? "selected-wrong"
                            : ""
                        }">
                            <span class="review-letter">${opt.letter}</span>
                            <span>${Utils.escapeHtml(opt.text)}</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
                ${
                  q.analysis
                    ? `
                    <div class="review-analysis">
                        <h4>解析</h4>
                        <p>${Utils.escapeHtml(q.analysis)}</p>
                    </div>
                `
                    : ""
                }
            `;
      container.appendChild(div);
    });

    this.closeModal("historyDetailModal");
    this.navigateTo("review");
  },

  saveProgress() {
    if (this.state.isTrial) {
      Utils.showToast("试用模式无法保存进度", "warning");
      return;
    }

    this.confirmDialog("保存进度", "确定要保存当前答题进度吗？", async () => {
      const progress = {
        id: Date.now(),
        questions: this.state.questions,
        answers: this.state.answers,
        markedQuestions: Array.from(this.state.markedQuestions),
        collectedQuestions: Array.from(this.state.collectedQuestions),
        currentQuestionIndex: this.state.currentQuestionIndex,
        timeRemaining: this.state.timeRemaining,
        startTime: this.state.startTime,
        isExam: this.state.isExam,
        selectedCategory: this.state.selectedCategory,
        practiceMode: this.state.practiceMode,
        practiceCompleted: Array.from(
          this.state.practiceCompleted || new Set()
        ),
        sourceType: this.state.sourceType || "normal",
      };

      const answeredCount = Object.keys(progress.answers).filter(
        (k) => progress.answers[k] !== null
      ).length;

      let type, mode, categoryName;
      if (this.state.sourceType === "wrong") {
        type = "错题练习";
        mode = "错题巩固";
        categoryName = "错题集";
      } else if (this.state.sourceType === "favorite") {
        type = "收藏练习";
        mode = "收藏练习";
        categoryName = "收藏夹";
      } else {
        type = this.state.isExam ? "模拟考试" : "刷题练习";
        mode = this.state.isExam
          ? "模拟考试"
          : this.state.practiceMode === "order"
          ? "顺序练习"
          : "随机练习";
        categoryName = this.state.selectedCategory;
      }

      await Storage.saveProgressRecord(this.state.currentUser.phone, {
        ...progress,
        categoryName,
        type,
        mode,
        answeredCount,
        totalCount: this.state.questions.length,
        progressPercent: Math.round(
          (answeredCount / this.state.questions.length) * 100
        ),
      });

      Utils.showToast("进度已保存", "success");
      this.stopTimer();
      this.stopThinkingTimer();
      this.goHome();
      await this.loadProgressRecords();
    });
  },

  async loadProgressRecords() {
    if (!this.state.currentUser || this.state.isTrial) {
      document.getElementById("progressRecords").style.display = "none";
      return;
    }

    const records = await Storage.getProgressRecords(
      this.state.currentUser.phone
    );
    const container = document.getElementById("recordsList");
    const banner = document.getElementById("progressRecords");

    if (records.length === 0) {
      banner.style.display = "none";
      return;
    }

    banner.style.display = "block";
    container.innerHTML = "";

    records.forEach((record) => {
      const div = document.createElement("div");
      div.className = "progress-record-item";
      div.innerHTML = `
          <div class="progress-record-info">
            <div class="record-type">${record.type} - ${record.mode}</div>
            <div class="record-meta">
              <span><i class="fa fa-folder-o"></i> ${record.categoryName}</span>
              <span><i class="fa fa-check-circle"></i> ${
                record.answeredCount
              }/${record.totalCount} (${record.progressPercent}%)</span>
            </div>
            <div class="record-date">
              <i class="fa fa-calendar"></i> ${this.formatDateTime(
                record.savedAt
              )}
            </div>
          </div>
          <div class="progress-record-actions">
            <button class="btn btn-sm btn-primary" onclick="App.restoreProgressRecord(${
              record.id
            })">
              <i class="fa fa-play"></i> 继续
            </button>
            <button class="btn btn-sm btn-outline" onclick="App.deleteProgressRecord(${
              record.id
            })">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        `;
      container.appendChild(div);
    });
  },

  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString();
  },

  async restoreProgressRecord(recordId) {
    const records = await Storage.getProgressRecords(
      this.state.currentUser.phone
    );
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    this.state.questions = record.questions;
    this.state.answers = record.answers;
    this.state.markedQuestions = new Set(record.markedQuestions);
    this.state.collectedQuestions = new Set(record.collectedQuestions);
    this.state.currentQuestionIndex = record.currentQuestionIndex;
    this.state.timeRemaining = record.timeRemaining;
    this.state.startTime = record.startTime;
    this.state.isExam = record.isExam;
    this.state.selectedCategory = record.selectedCategory;
    this.state.practiceMode = record.practiceMode || "order";
    this.state.practiceCompleted = new Set(record.practiceCompleted || []);

    await Storage.deleteProgressRecord(this.state.currentUser.phone, recordId);

    this.navigateTo("answer");
    await this.renderQuestion();
    if (this.state.isExam) {
      this.startTimer();
    }
    this.startThinkingTimer();
    await this.updateNavPanel();
    await this.updateNavItemStyles();
  },

  deleteProgressRecord(recordId) {
    this.confirmDialog("删除记录", "确定要删除这条进度记录吗？", async () => {
      await Storage.deleteProgressRecord(
        this.state.currentUser.phone,
        recordId
      );
      await this.loadProgressRecords();
      Utils.showToast("记录已删除", "success");
    });
  },

  clearAllProgress() {
    this.confirmDialog(
      "清空进度",
      "确定要清空所有答题进度记录吗？此操作不可恢复！",
      async () => {
        await Storage.clearAllProgress(this.state.currentUser.phone);
        await this.loadProgressRecords();
        Utils.showToast("已清空所有进度记录", "success");
      }
    );
  },

  async checkContinueProgress() {
    if (!this.state.currentUser || this.state.isTrial) return;

    const records = await Storage.getProgressRecords(
      this.state.currentUser.phone
    );
    if (records.length > 0) {
      this.state.savedProgress = records[0];
      Utils.showModal("continueModal");
    }
  },

  async autoSaveProgress() {
    if (!this.state.questions || this.state.questions.length === 0) return;
    if (this.state.isTrial) return;
    if (!this.state.currentUser) return;

    const answeredCount = Object.keys(this.state.answers).filter(
      (k) => this.state.answers[k] !== null
    ).length;

    if (answeredCount === 0) return;

    const progress = {
      id: Date.now(),
      questions: this.state.questions,
      answers: this.state.answers,
      markedQuestions: Array.from(this.state.markedQuestions),
      collectedQuestions: Array.from(this.state.collectedQuestions),
      currentQuestionIndex: this.state.currentQuestionIndex,
      timeRemaining: this.state.timeRemaining,
      startTime: this.state.startTime,
      isExam: this.state.isExam,
      selectedCategory: this.state.selectedCategory,
      practiceMode: this.state.practiceMode,
      practiceCompleted: Array.from(this.state.practiceCompleted || new Set()),
    };

    const answered = Object.keys(progress.answers).filter(
      (k) => progress.answers[k] !== null
    ).length;

    await Storage.saveProgressRecord(this.state.currentUser.phone, {
      ...progress,
      categoryName: this.state.selectedCategory,
      type: this.state.isExam ? "模拟考试" : "刷题练习",
      mode: this.state.isExam
        ? "模拟考试"
        : this.state.practiceMode === "order"
        ? "顺序练习"
        : "随机练习",
      answeredCount: answered,
      totalCount: this.state.questions.length,
      progressPercent: Math.round(
        (answered / this.state.questions.length) * 100
      ),
    });
  },

  async continueProgress() {
    const progress = this.state.savedProgress;
    if (!progress) return;

    this.state.questions = progress.questions;
    this.state.answers = progress.answers;
    this.state.markedQuestions = new Set(progress.markedQuestions);
    this.state.collectedQuestions = new Set(progress.collectedQuestions);
    this.state.currentQuestionIndex = progress.currentQuestionIndex;
    this.state.timeRemaining = progress.timeRemaining;
    this.state.startTime = progress.startTime;
    this.state.isExam = progress.isExam;
    this.state.isTrial = false;
    this.state.practiceCompleted = new Set(progress.practiceCompleted || []);

    this.closeModal("continueModal");
    this.navigateTo("answer");
    await this.renderQuestion();
    this.startTimer();
    this.startThinkingTimer();
    await this.updateNavPanel();
  },

  discardProgress() {
    Storage.clearTempProgress();
    this.state.savedProgress = null;
    this.closeModal("continueModal");
  },

  exitAndSave() {
    this.saveProgress();
  },

  checkSavedProgress() {
    const progress = Storage.getTempProgress();
    if (progress) {
      const savedDate = new Date(progress.savedAt);
      const now = new Date();
      const hoursDiff = (now - savedDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        Storage.clearTempProgress();
      }
    }
  },

  closeModal(modalId) {
    Utils.hideModal(modalId);
  },

  confirmDialog(title, message, onConfirm) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;

    const okBtn = document.getElementById("confirmOkBtn");
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener("click", () => {
      this.closeModal("confirmModal");
      onConfirm();
    });

    Utils.showModal("confirmModal");
  },

  goHome() {
    this.stopTimer();
    this.stopThinkingTimer();
    this.state.questions = [];
    this.state.answers = [];
    this.showMainPage();
  },

  goBack() {
    this.stopTimer();
    this.stopThinkingTimer();

    const currentPage = this.state.currentPage;

    if (currentPage === "answer" || currentPage === "result") {
      this.showMainPage();
    } else if (currentPage === "review") {
      this.showResultPage(
        this.state.lastResult || {
          score: 0,
          totalQuestions: 0,
          correctCount: 0,
          wrongCount: 0,
          timeUsed: 0,
        }
      );
    } else if (
      currentPage === "wrong" ||
      currentPage === "favorite" ||
      currentPage === "history"
    ) {
      this.showMainPage();
    } else if (currentPage === "examType") {
      this.showMainPage();
    } else {
      this.showMainPage();
    }
  },

  logout() {
    const wasTrial = this.state.isTrial;
    this.state.currentUser = null;
    this.state.isTrial = false;
    this.state.isExam = false;
    this.state.markedQuestions = new Set();
    this.state.collectedQuestions = new Set();
    Storage.clearCurrentUser();
    if (wasTrial) {
      Storage.clearTrialProgress();
    }
    Utils.showToast("已退出登录", "info");
    this.navigateTo("login");
  },

  async updateAdminStats() {
    const users = await Storage.getUsers();
    const questions = QuestionData.getTotalCount();
    const typeCount = QuestionData.getTypeCount();
    const codes = await Storage.getActivationCodes();

    document.getElementById("totalUsers").textContent = users.length;
    document.getElementById("totalQuestions").textContent = questions;
    document.getElementById("judgmentCount").textContent = typeCount["判断题"];
    document.getElementById("choiceCount").textContent = typeCount["单选题"];

    const usedCodes = codes.filter((c) => c.usedCount > 0).length;
    document.getElementById("totalCodes").textContent = codes.length;
    document.getElementById("usedCodes").textContent = usedCodes;
    document.getElementById("unusedCodes").textContent =
      codes.length - usedCodes;
  },

  updateQuestionBankStats() {
    const typeCount = QuestionData.getTypeCount();
    const categoryStats = QuestionData.getCategoryStats();

    document.getElementById("totalQuestions").textContent =
      QuestionData.getTotalCount();
    document.getElementById("judgmentCount").textContent = typeCount["判断题"];
    document.getElementById("choiceCount").textContent = typeCount["单选题"];

    const container = document.getElementById("categoryStatsGrid");
    container.innerHTML = "";

    const allCategories = [
      "国职游泳救生员初级",
      "国职游泳救生员中级",
      "国职游泳救生员高级",
      "国职游泳指导员初级",
      "国职游泳指导员中级",
      "国职游泳指导员高级",
    ];

    const allSubCategories = ["基础常识", "技能知识", "急救知识", "管理规范"];

    allCategories.forEach((cat) => {
      const stats = categoryStats[cat] || {
        total: 0,
        判断题: 0,
        单选题: 0,
        subCategories: {},
      };
      const isBuilding = cat !== "国职游泳救生员初级";

      let subCatHtml = "";
      allSubCategories.forEach((subCat) => {
        const count = stats.subCategories?.[subCat] || 0;
        subCatHtml += `
          <div class="stat-row">
            <span>${subCat}</span>
            <span class="stat-num">${count}</span>
          </div>
        `;
      });

      const div = document.createElement("div");
      div.className = `category-stat-card ${isBuilding ? "building" : ""}`;
      div.innerHTML = `
        <div class="category-name">${cat}</div>
        <div class="stat-row">
          <span>总题数</span>
          <span class="stat-num">${stats.total}</span>
        </div>
        <div class="stat-row">
          <span>判断题</span>
          <span class="stat-num">${stats.判断题}</span>
        </div>
        <div class="stat-row">
          <span>单选题</span>
          <span class="stat-num">${stats.单选题}</span>
        </div>
        <div class="subcat-breakdown">
          ${subCatHtml}
        </div>
      `;
      container.appendChild(div);
    });
  },

  async loadUserManagement() {
    const users = await Storage.getUsers();
    const tbody = document.getElementById("userTableBody");
    tbody.innerHTML = "";

    for (const user of users) {
      const stats = await Storage.getUserStats(user.phone);
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${user.phone}</td>
                <td>${user.name}</td>
                <td>${stats.totalQuestions}</td>
                <td>${stats.accuracy}%</td>
                <td>${Utils.formatDateOnly(user.registerTime)}</td>
            `;
      tbody.appendChild(tr);
    }
  },

  loadQuestionBankManagement(filterCategory = "all") {
    this.state.currentFilterCategory = filterCategory;
    let questions = QuestionData.questions;

    if (filterCategory !== "all") {
      questions = questions.filter((q) => q.category === filterCategory);
    }

    const list = document.getElementById("questionList");
    list.innerHTML = "";

    if (questions.length === 0) {
      list.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <i class="fa fa-inbox" style="font-size: 4rem; color: var(--text-light); margin-bottom: 20px;"></i>
                    <p>该类别暂无题目</p>
                </div>
            `;
      return;
    }

    questions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "question-list-item";
      div.dataset.id = q.id;
      div.innerHTML = `
                <input type="checkbox" class="question-checkbox" data-id="${
                  q.id
                }" />
                <span class="index">${index + 1}</span>
                <span class="type">${q.type}</span>
                <span class="category-tag">${q.category}</span>
                <span class="subcategory-tag">${
                  q.subCategory || "基础常识"
                }</span>
                <span class="content">${Utils.escapeHtml(q.question)}</span>
                <div class="actions">
                    <button class="action-btn edit" onclick="App.editQuestion(${
                      q.id
                    })">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="App.deleteQuestion(${
                      q.id
                    })">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            `;
      list.appendChild(div);
    });

    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.category === filterCategory) {
        btn.classList.add("active");
      }
    });
  },

  filterQuestionBank(category) {
    this.loadQuestionBankManagement(category);
  },

  selectAllQuestions() {
    const checkboxes = document.querySelectorAll(
      ".question-list-item .question-checkbox"
    );
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => (cb.checked = !allChecked));
  },

  batchDeleteQuestions() {
    const selectedIds = Array.from(
      document.querySelectorAll(
        ".question-list-item .question-checkbox:checked"
      )
    ).map((cb) => parseInt(cb.dataset.id));

    if (selectedIds.length === 0) {
      Utils.showToast("请先选择要删除的题目", "warning");
      return;
    }

    this.confirmDialog(
      "删除题目",
      `确定要删除选中的 ${selectedIds.length} 道题目吗？`,
      () => {
        QuestionData.questions = QuestionData.questions.filter(
          (q) => !selectedIds.includes(q.id)
        );
        Storage.saveQuestions(QuestionData.questions);
        Utils.showToast(`已删除 ${selectedIds.length} 道题目`, "success");
        this.updateQuestionBankStats();
        this.loadQuestionBankManagement(
          this.state.currentFilterCategory || "all"
        );
      }
    );
  },

  clearCategoryQuestions() {
    const category = this.state.currentFilterCategory;
    if (!category || category === "all") {
      Utils.showToast("请先选择一个具体的类别", "warning");
      return;
    }

    const count = QuestionData.questions.filter(
      (q) => q.category === category
    ).length;
    if (count === 0) {
      Utils.showToast("该类别暂无题目", "info");
      return;
    }

    this.confirmDialog(
      "清空类别",
      `确定要清空 "${category}" 的所有题目吗？共 ${count} 道题。此操作不可恢复！`,
      () => {
        QuestionData.questions = QuestionData.questions.filter(
          (q) => q.category !== category
        );
        Storage.saveQuestions(QuestionData.questions);
        Utils.showToast(`已清空 ${count} 道题目`, "success");
        this.updateQuestionBankStats();
        this.loadQuestionBankManagement("all");
      }
    );
  },

  clearAllQuestions() {
    const totalCount = QuestionData.questions.length;
    if (totalCount === 0) {
      Utils.showToast("题库已经是空的", "info");
      return;
    }

    this.confirmDialog(
      "清空全部题库",
      `警告：确定要清空全部题库吗？这将删除所有 ${totalCount} 道题目，此操作不可恢复！`,
      () => {
        this.confirmDialog(
          "再次确认",
          "再次确认：确定要清空全部题库吗？",
          () => {
            QuestionData.questions = [];
            Storage.saveQuestions([]);
            Utils.showToast("已清空全部题库", "success");
            this.updateQuestionBankStats();
            this.loadQuestionBankManagement("all");
          }
        );
      }
    );
  },

  downloadTemplate() {
    const template = `序号,题型,题库分类（大类）,题目分类（小类）,题干,选项A,选项B,选项C,选项D,答案,解释
1,判断题,国职游泳救生员初级,基础常识,游泳救生员是指在游泳场所从事保障游泳者生命安全的人员。,正确,错误,,,正确,救生员的职责是保障游泳者安全
2,单选题,国职游泳救生员初级,基础常识,游泳池水面面积在250㎡及以下，应至少配备几名救生员？,1名,2名,3名,4名,B,
3,判断题,国职游泳救生员初级,急救知识,发现溺水者应立即下水施救。,正确,错误,,,错误,应先呼救并使用救生器材
4,单选题,国职游泳救生员初级,技能知识,救生员岸上入水采用哪种方式最快？,跨步式入水,潜水式入水,跑步式入水,跳跃式入水,跨步式入水,
5,单选题,国职游泳救生员初级,管理规范,游泳场所应在醒目位置设置什么？,救生员照片,安全提示,急救电话,以上都是,D,`;

    const blob = new Blob(["\uFEFF" + template], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "题库导入模板.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.showToast("模板已下载", "success");
  },

  editQuestion(id) {
    const question = QuestionData.getQuestionById(id);
    if (!question) return;

    document.getElementById("editQuestionId").value = question.id;
    document.getElementById("editQuestionType").value = question.type;
    document.getElementById("editQuestionCategory").value = question.category;
    document.getElementById("editQuestionText").value = question.question;
    document.getElementById("editOptionA").value = question.optionA || "";
    document.getElementById("editOptionB").value = question.optionB || "";
    document.getElementById("editOptionC").value = question.optionC || "";
    document.getElementById("editOptionD").value = question.optionD || "";
    document.getElementById("editCorrectAnswer").value = question.answer;
    document.getElementById("editAnalysis").value = question.analysis || "";

    this.updateEditOptionRow();

    Utils.showModal("editQuestionModal");
  },

  updateEditOptionRow() {
    const type = document.getElementById("editQuestionType").value;
    document.getElementById("editOptionRow").style.display =
      type === "单选题" ? "flex" : "none";
  },

  async saveEditedQuestion() {
    const id = parseInt(document.getElementById("editQuestionId").value);
    const type = document.getElementById("editQuestionType").value;
    const category = document.getElementById("editQuestionCategory").value;
    const question = document.getElementById("editQuestionText").value.trim();
    const optionA = document.getElementById("editOptionA").value.trim();
    const optionB = document.getElementById("editOptionB").value.trim();
    const optionC =
      type === "单选题"
        ? document.getElementById("editOptionC").value.trim()
        : "";
    const optionD =
      type === "单选题"
        ? document.getElementById("editOptionD").value.trim()
        : "";
    const answer = document.getElementById("editCorrectAnswer").value;
    const analysis = document.getElementById("editAnalysis").value.trim();

    if (!question || !optionA || !optionB) {
      Utils.showToast("请填写完整的题目信息", "error");
      return;
    }

    const result = QuestionData.updateQuestion(id, {
      type,
      category,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      answer,
      analysis,
    });

    if (result.success) {
      this.closeModal("editQuestionModal");
      this.loadQuestionBankManagement();
      this.updateQuestionBankStats();
      await this.updateAdminStats();
      Utils.showToast("题目修改成功", "success");
    } else {
      Utils.showToast(result.message, "error");
    }
  },

  async deleteQuestion(id) {
    if (confirm("确定要删除这道题吗？")) {
      QuestionData.deleteQuestion(id);
      this.loadQuestionBankManagement();
      await this.updateAdminStats();
      Utils.showToast("删除成功", "success");
    }
  },

  async loadActivationCodeManagement() {
    const codes = await Storage.getActivationCodes();
    const tbody = document.getElementById("codeTableBody");
    tbody.innerHTML = "";

    codes.forEach((code, index) => {
      const isExpired = new Date(code.expiresAt) < new Date();
      const status =
        code.usedCount >= code.maxUses && code.maxUses > 0
          ? "used"
          : isExpired
          ? "expired"
          : "unused";

      const statusText =
        status === "used"
          ? "已使用"
          : status === "expired"
          ? "已过期"
          : "未使用";
      const usesText =
        code.maxUses > 0 ? `${code.usedCount}/${code.maxUses}` : "不限";

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><input type="checkbox" class="code-checkbox" value="${
                  code.code
                }" /></td>
                <td class="code-cell-wrapper">
                    <span class="code-cell">${code.code}</span>
                    <button class="inline-copy-btn" onclick="App.copyCode('${
                      code.code
                    }', this)" title="复制激活码">
                        <i class="fa fa-copy"></i>
                    </button>
                </td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
                <td class="uses-cell">${usesText}</td>
                <td class="date-cell">${Utils.formatDateOnly(
                  code.expiresAt
                )}</td>
                <td class="date-cell">${Utils.formatDateOnly(
                  code.createdAt
                )}</td>
            `;
      tbody.appendChild(tr);
    });
  },

  copyCode(code, btn) {
    Utils.copyToClipboard(code);
    const icon = btn.querySelector("i");
    icon.className = "fa fa-check";
    btn.classList.add("copied");
    setTimeout(() => {
      icon.className = "fa fa-copy";
      btn.classList.remove("copied");
    }, 2000);
  },

  async generateCodes() {
    const count =
      parseInt(document.getElementById("generateCount").value) || 10;
    const validityDays =
      parseInt(document.getElementById("validityDays").value) || 30;
    const maxUses = parseInt(document.getElementById("maxUses").value) || 1;

    const codes = await Storage.generateCodes(count, {
      validityDays,
      maxUses: maxUses > 0 ? maxUses : 0,
    });

    await this.loadActivationCodeManagement();
    await this.updateAdminStats();

    const codeList = codes.map((c) => c.code).join("\n");
    if (
      confirm(`已生成 ${count} 个激活码，是否复制到剪贴板？\n\n${codeList}`)
    ) {
      Utils.copyToClipboard(codeList);
      Utils.showToast("已复制到剪贴板", "success");
    }
  },

  selectAllCodes() {
    const checkboxes = document.querySelectorAll(".code-checkbox");
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => (cb.checked = !allChecked));
  },

  async deleteSelectedCodes() {
    const checkboxes = document.querySelectorAll(".code-checkbox:checked");
    if (checkboxes.length === 0) {
      Utils.showToast("请先选择要删除的激活码", "warning");
      return;
    }

    const codesToDelete = Array.from(checkboxes).map((cb) => cb.value);

    if (!confirm(`确定要删除选中的 ${checkboxes.length} 个激活码吗？`)) return;

    for (const codeValue of codesToDelete) {
      await Storage.deleteCode(codeValue);
    }

    await this.loadActivationCodeManagement();
    await this.updateAdminStats();
    Utils.showToast("删除成功", "success");
  },

  async clearAllCodes() {
    if (!confirm("确定要清空所有激活码吗？此操作不可恢复！")) return;

    await Storage.clearAllCodes();
    await this.loadActivationCodeManagement();
    await this.updateAdminStats();
    Utils.showToast("已清空所有激活码", "success");
  },

  toggleSelectAllCodes() {
    const master = document.getElementById("selectAllCodes");
    document.querySelectorAll(".code-checkbox").forEach((cb) => {
      cb.checked = master.checked;
    });
  },

  handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "image/png") {
      Utils.showToast("请上传PNG格式的图片", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      document.getElementById("logoPreview").src = dataUrl;
      Storage.updateLogo(dataUrl);
      Utils.showToast("Logo上传成功", "success");
    };
    reader.readAsDataURL(file);
  },

  saveSettings() {
    const siteName = document.getElementById("siteNameInput").value.trim();
    const examInfoText = document.getElementById("examInfoInput").value.trim();
    const adminPassword = document
      .getElementById("adminPasswordInput")
      .value.trim();
    const wrongThreshold =
      parseInt(document.getElementById("wrongThreshold").value) || 3;

    const lines = examInfoText.split("\n").filter((l) => l.trim());
    const examInfo = {};
    lines.forEach((line) => {
      const [key, ...values] = line.split("：");
      if (key && values.length) {
        examInfo[key.trim()] = values.join("：").trim();
      }
    });

    const settings = {
      siteName: siteName || "水知晴体育国职模拟考试系统",
      examInfo,
    };

    if (adminPassword) {
      settings.adminPassword = adminPassword;
    }

    if (wrongThreshold >= 1 && wrongThreshold <= 10) {
      settings.wrongThreshold = wrongThreshold;
    }

    Storage.saveSettings(settings);

    this.loadSettings();
    Utils.showToast("设置已保存", "success");
  },

  async importQuestions(input) {
    const file = input.files ? input.files[0] : input;
    if (!file) return;

    const category = document.getElementById("importCategorySelect").value;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target.result;
      const result = await QuestionData.loadFromCSV(csvText, category);

      Utils.showToast(
        `导入完成：新增${result.new}题，重复${result.duplicate}题，导入至"${category}"`,
        "success"
      );
      this.loadQuestionBankManagement();
      this.updateQuestionBankStats();
      await this.updateAdminStats();
    };
    reader.readAsText(file);
  },

  handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const category = document.getElementById("importCategorySelect").value;
    const reader = new FileReader();

    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      const csvText = await this.decodeCSV(arrayBuffer);
      const previewData = this.parseCSVPreview(csvText);

      document.getElementById("previewFileName").textContent = file.name;
      document.getElementById("previewTargetCategory").textContent = category;
      document.getElementById("previewTotalRows").textContent =
        previewData.total;
      document.getElementById("previewValidCount").textContent =
        previewData.valid;
      document.getElementById("previewSkipCount").textContent =
        previewData.skip || 0;

      const tbody = document.getElementById("importPreviewBody");
      tbody.innerHTML = "";

      previewData.rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.number}</td>
          <td><span class="type-badge ${
            row.type === "判断题" ? "judgment" : ""
          }">${row.type}</span></td>
          <td>${row.category}</td>
          <td>${row.subCategory}</td>
          <td title="${Utils.escapeHtml(row.question)}">${Utils.escapeHtml(
          row.question
        )}</td>
          <td>${row.answer}</td>
        `;
        tbody.appendChild(tr);
      });

      this.state.pendingImportData = { csvText, category, previewData };
      Utils.showModal("importPreviewModal");
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  },

  async decodeCSV(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);

    const isUTF8 = (bytes) => {
      let i = 0;
      while (i < bytes.length && i < 3) {
        if (
          bytes[i] === 0xef &&
          bytes[i + 1] === 0xbb &&
          bytes[i + 2] === 0xbf
        ) {
          return true;
        }
        i++;
      }
      return false;
    };

    if (isUTF8(uint8Array)) {
      return new TextDecoder("utf-8").decode(uint8Array);
    }

    try {
      const decoder = new TextDecoder("gbk");
      return decoder.decode(uint8Array);
    } catch (e) {
      try {
        return new TextDecoder("gb18030").decode(uint8Array);
      } catch (e2) {
        return new TextDecoder("utf-8", { fatal: false }).decode(uint8Array);
      }
    }
  },

  parseCSVPreview(csvText) {
    const lines = csvText.trim().split("\n");
    const rows = [];
    let valid = 0;
    let skip = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skip++;
        continue;
      }

      const values = this.parseCSVLine(line);
      if (values.length < 10) {
        skip++;
        continue;
      }

      const question = values[4]?.trim();
      if (!question) {
        skip++;
        continue;
      }

      valid++;

      if (rows.length < 50) {
        rows.push({
          number: parseInt(values[0]) || i,
          type: values[1]?.trim() || "判断题",
          category: values[2]?.trim() || "国职游泳救生员初级",
          subCategory: values[3]?.trim() || "基础常识",
          question: question,
          answer: values[9]?.trim() || "",
        });
      }
    }

    return { total: lines.length - 1, valid, skip, rows };
  },

  parseCSVLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  },

  async confirmImport() {
    const { csvText, category, previewData } = this.state.pendingImportData;
    if (!csvText) return;

    const result = await QuestionData.loadFromCSV(csvText, category);

    Utils.showToast(
      `导入完成：新增${result.new}题，重复${result.duplicate}题，合计${result.total}题`,
      "success"
    );
    this.updateQuestionBankStats();
    this.loadQuestionBankManagement();
    await this.updateAdminStats();

    closeModal("importPreviewModal");
    this.state.pendingImportData = null;
  },

  exportQuestions() {
    const csv = QuestionData.exportToCSV();
    Utils.downloadCSV(
      csv,
      `题库导出_${new Date().toISOString().slice(0, 10)}.csv`
    );
    Utils.showToast("题库导出成功", "success");
  },

  showAddQuestion() {
    Utils.showModal("addQuestionModal");
  },

  async saveNewQuestion() {
    const type = document.getElementById("addQuestionType").value;
    const category = document
      .getElementById("addQuestionCategory")
      .value.trim();
    const question = document.getElementById("addQuestionText").value.trim();
    const optionA = document.getElementById("addOptionA").value.trim();
    const optionB = document.getElementById("addOptionB").value.trim();
    const optionC =
      type === "单选题"
        ? document.getElementById("addOptionC").value.trim()
        : "";
    const optionD =
      type === "单选题"
        ? document.getElementById("addOptionD").value.trim()
        : "";
    const answer = document.getElementById("addCorrectAnswer").value;
    const analysis = document.getElementById("addAnalysis").value.trim();

    if (!question || !optionA || !optionB) {
      Utils.showToast("请填写完整的题目信息", "error");
      return;
    }

    const result = QuestionData.addQuestion({
      type,
      category: category || "未分类",
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      answer,
      analysis,
    });

    if (result.success) {
      this.closeModal("addQuestionModal");
      this.loadQuestionBankManagement();
      await this.updateAdminStats();

      document.getElementById("addQuestionType").value = "判断题";
      document.getElementById("addQuestionCategory").value = "";
      document.getElementById("addQuestionText").value = "";
      document.getElementById("addOptionA").value = "";
      document.getElementById("addOptionB").value = "";
      document.getElementById("addOptionC").value = "";
      document.getElementById("addOptionD").value = "";
      document.getElementById("addAnalysis").value = "";

      Utils.showToast("题目添加成功", "success");
    } else {
      Utils.showToast(result.message, "error");
    }
  },
};

window.App = App;

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

function goBack() {
  App.goBack();
}

function goHome() {
  App.goHome();
}

function logout() {
  App.logout();
}

function openTab(tabId) {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.style.display = "none";
  });
  document.getElementById(tabId).style.display = "block";
}

function closeModal(modalId) {
  App.closeModal(modalId);
}

function discardProgress() {
  App.discardProgress();
}

function continueProgress() {
  App.continueProgress();
}

function clearAllProgress() {
  App.clearAllProgress();
}

function confirmSubmit() {
  App.confirmSubmit();
}

function exitAndSave() {
  App.exitAndSave();
}
