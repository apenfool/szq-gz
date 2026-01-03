const Storage = {
  KEYS: {
    USERS: "exam_users",
    CURRENT_USER: "exam_current_user",
    HISTORY: "exam_history",
    FAVORITES: "exam_favorites",
    FAVORITE_DATA: "exam_favorite_data",
    ACTIVATION_CODES: "exam_activation_codes",
    SETTINGS: "exam_settings",
    TEMP_PROGRESS: "exam_temp_progress",
    QUESTIONS: "exam_questions",
    PROGRESS_RECORDS: "exam_progress_records",
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error("Storage get error:", e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Storage set error:", e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error("Storage remove error:", e);
      return false;
    }
  },

  clear() {
    try {
      Object.values(this.KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (e) {
      console.error("Storage clear error:", e);
      return false;
    }
  },

  async getUsers() {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudUsers = await CloudStorage.getUsers();
        if (cloudUsers !== null) {
          this.set(this.KEYS.USERS, cloudUsers);
          return cloudUsers;
        }
      } catch (e) {
        console.warn("云端获取用户失败，降级到本地存储");
      }
    }
    return this.get(this.KEYS.USERS, []);
  },

  async saveUser(user) {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.phone === user.phone);
    if (index >= 0) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    this.set(this.KEYS.USERS, users);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveUser(user).catch((e) =>
        console.warn("云端保存用户失败:", e)
      );
    }

    return user;
  },

  async getUserByPhone(phone) {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudUser = await CloudStorage.getUserByPhone(phone);
        if (cloudUser !== null) {
          return cloudUser;
        }
      } catch (e) {
        console.warn("云端获取用户失败，降级到本地存储");
      }
    }
    const users = this.get(this.KEYS.USERS, []);
    return users.find((u) => u.phone === phone);
  },

  getUserStats(phone) {
    const user = this.getUserByPhone(phone);
    if (!user) return null;

    const history = this.getHistory(phone);
    const wrongQuestions = this.getWrongQuestions(phone);
    const favorites = this.getFavorites(phone);

    const totalAnswered = history.reduce((sum, h) => sum + h.totalQuestions, 0);
    const totalCorrect = history.reduce((sum, h) => sum + h.correctCount, 0);

    return {
      totalQuestions: totalAnswered,
      correctCount: totalCorrect,
      wrongCount: totalAnswered - totalCorrect,
      accuracy:
        totalAnswered > 0
          ? Math.round((totalCorrect / totalAnswered) * 100)
          : 0,
      historyCount: history.length,
      wrongCount: wrongQuestions.length,
      favoriteCount: favorites.length,
    };
  },

  getCurrentUser() {
    return this.get(this.KEYS.CURRENT_USER, null);
  },

  setCurrentUser(user) {
    this.set(this.KEYS.CURRENT_USER, user);
  },

  clearCurrentUser() {
    this.remove(this.KEYS.CURRENT_USER);
  },

  async getUserStats(phone) {
    const user = await this.getUserByPhone(phone);
    if (!user) return null;

    const history = await this.getHistory(phone);
    const wrongQuestions = await this.getWrongQuestions(phone);
    const favorites = await this.getFavorites(phone);

    const totalAnswered = history.reduce((sum, h) => sum + h.totalQuestions, 0);
    const totalCorrect = history.reduce((sum, h) => sum + h.correctCount, 0);

    return {
      totalQuestions: totalAnswered,
      correctCount: totalCorrect,
      wrongCount: totalAnswered - totalCorrect,
      accuracy:
        totalAnswered > 0
          ? Math.round((totalCorrect / totalAnswered) * 100)
          : 0,
      historyCount: history.length,
      wrongCount: wrongQuestions.length,
      favoriteCount: favorites.length,
    };
  },

  async getHistory(phone) {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudHistory = await CloudStorage.getHistory(phone);
        if (cloudHistory !== null) {
          return cloudHistory;
        }
      } catch (e) {
        console.warn("云端获取历史记录失败，降级到本地存储");
      }
    }
    const allHistory = this.get(this.KEYS.HISTORY, {});
    return allHistory[phone] || [];
  },

  async saveHistory(phone, historyItem) {
    const allHistory = this.get(this.KEYS.HISTORY, {});
    if (!allHistory[phone]) {
      allHistory[phone] = [];
    }
    allHistory[phone].unshift(historyItem);
    this.set(this.KEYS.HISTORY, allHistory);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveHistory(phone, historyItem).catch((e) =>
        console.warn("云端保存历史记录失败:", e)
      );
    }
  },

  updateHistory(phone, historyId, updates) {
    const allHistory = this.get(this.KEYS.HISTORY, {});
    if (!allHistory[phone]) return false;

    const index = allHistory[phone].findIndex((h) => h.id === historyId);
    if (index >= 0) {
      allHistory[phone][index] = { ...allHistory[phone][index], ...updates };
      this.set(this.KEYS.HISTORY, allHistory);
      return true;
    }
    return false;
  },

  deleteHistory(phone, historyDate) {
    const allHistory = this.get(this.KEYS.HISTORY, {});
    if (!allHistory[phone]) return false;

    allHistory[phone] = allHistory[phone].filter((h) => h.date !== historyDate);
    this.set(this.KEYS.HISTORY, allHistory);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.deleteHistory(phone, historyDate).catch((e) =>
        console.warn("云端删除历史记录失败:", e)
      );
    }
    return true;
  },

  removeHistory(phone, historyId) {
    return this.deleteHistory(phone, historyId);
  },

  clearHistory(phone) {
    const allHistory = this.get(this.KEYS.HISTORY, {});
    delete allHistory[phone];
    this.set(this.KEYS.HISTORY, allHistory);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.clearHistory(phone).catch((e) =>
        console.warn("云端清空历史记录失败:", e)
      );
    }
    return true;
  },

  async getFavorites(phone) {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudFavorites = await CloudStorage.getFavorites(phone);
        if (cloudFavorites !== null) {
          return cloudFavorites.map((f) => f.questionId);
        }
      } catch (e) {
        console.warn("云端获取收藏列表失败，降级到本地存储");
      }
    }
    const allFavorites = this.get(this.KEYS.FAVORITES, {});
    const userFavorites = allFavorites[phone];

    if (!userFavorites) {
      return [];
    }

    if (Array.isArray(userFavorites)) {
      await this.migrateFavoritesFormat(phone, allFavorites);
      const migratedFavorites = this.get(this.KEYS.FAVORITES, {});
      const newFormat = migratedFavorites[phone];
      if (newFormat && newFormat.ids) {
        return newFormat.ids;
      }
      return userFavorites;
    }

    return userFavorites.ids || [];
  },

  async migrateFavoritesFormat(phone, allFavorites) {
    try {
      const oldFavorites = allFavorites[phone];
      if (!oldFavorites || !Array.isArray(oldFavorites)) {
        return;
      }

      const allFavoriteData = this.get(this.KEYS.FAVORITE_DATA, {});
      const questionData = allFavoriteData[phone] || {};

      if (Object.keys(questionData).length === 0) {
        for (const id of oldFavorites) {
          const question = QuestionData.getQuestionById(id);
          if (question) {
            questionData[id] = question;
          }
        }
        allFavoriteData[phone] = questionData;
        this.set(this.KEYS.FAVORITE_DATA, allFavoriteData);
      }

      allFavorites[phone] = {
        ids: [...oldFavorites],
        questions: questionData,
      };
      this.set(this.KEYS.FAVORITES, allFavorites);
      console.log("收藏数据格式迁移完成:", {
        phone,
        count: oldFavorites.length,
      });
    } catch (e) {
      console.error("收藏数据格式迁移失败:", e);
    }
  },

  async addFavorite(phone, questionId, questionData = null) {
    const allFavorites = this.get(this.KEYS.FAVORITES, {});

    if (
      !allFavorites[phone] ||
      typeof allFavorites[phone] !== "object" ||
      Array.isArray(allFavorites[phone])
    ) {
      allFavorites[phone] = { ids: [], questions: {} };
    }

    if (!allFavorites[phone].ids || !Array.isArray(allFavorites[phone].ids)) {
      allFavorites[phone].ids = [];
    }

    if (!allFavorites[phone].ids.includes(questionId)) {
      allFavorites[phone].ids.push(questionId);
      this.set(this.KEYS.FAVORITES, allFavorites);
    }

    if (questionData) {
      const allFavoriteData = this.get(this.KEYS.FAVORITE_DATA, {});
      if (!allFavoriteData[phone]) {
        allFavoriteData[phone] = {};
      }
      allFavoriteData[phone][questionId] = questionData;
      this.set(this.KEYS.FAVORITE_DATA, allFavoriteData);
    }

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.addFavorite(phone, questionId).catch((e) =>
        console.warn("云端添加收藏失败:", e)
      );
    }
    return true;
  },

  async removeFavorite(phone, questionId) {
    const allFavorites = this.get(this.KEYS.FAVORITES, {});
    if (!allFavorites[phone]) return false;

    const userFavorites = allFavorites[phone];
    if (Array.isArray(userFavorites)) {
      const index = userFavorites.indexOf(questionId);
      if (index >= 0) {
        userFavorites.splice(index, 1);
        this.set(this.KEYS.FAVORITES, allFavorites);
      }
    } else if (userFavorites.ids) {
      const index = userFavorites.ids.indexOf(questionId);
      if (index >= 0) {
        userFavorites.ids.splice(index, 1);
        this.set(this.KEYS.FAVORITES, allFavorites);
      }
    }

    const favoriteData = this.get(this.KEYS.FAVORITE_DATA, {});
    if (favoriteData[phone]) {
      delete favoriteData[phone][questionId];
      this.set(this.KEYS.FAVORITE_DATA, favoriteData);
    }

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.removeFavorite(phone, questionId).catch((e) =>
        console.warn("云端取消收藏失败:", e)
      );
    }
    return true;
  },

  clearFavorites(phone) {
    const allFavorites = this.get(this.KEYS.FAVORITES, {});
    delete allFavorites[phone];
    this.set(this.KEYS.FAVORITES, allFavorites);

    const favoriteData = this.get(this.KEYS.FAVORITE_DATA, {});
    delete favoriteData[phone];
    this.set(this.KEYS.FAVORITE_DATA, favoriteData);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.clearFavorites(phone).catch((e) =>
        console.warn("云端清空收藏失败:", e)
      );
    }
    return true;
  },

  isFavorite(phone, questionId) {
    const allFavorites = this.get(this.KEYS.FAVORITES, {});
    const userFavorites = allFavorites[phone];

    if (!userFavorites) {
      return false;
    }

    if (Array.isArray(userFavorites)) {
      return userFavorites.includes(questionId);
    }

    return userFavorites.ids?.includes(questionId) || false;
  },

  async getFavoritesByCategory(phone) {
    const favoriteIds = await this.getFavorites(phone);
    const favoriteData = this.get(this.KEYS.FAVORITE_DATA, {});
    const userFavorites = favoriteData[phone] || {};
    const favorites = [];

    favoriteIds.forEach((id) => {
      if (userFavorites[id]) {
        favorites.push(userFavorites[id]);
      } else if (
        typeof QuestionData !== "undefined" &&
        QuestionData.isLoaded()
      ) {
        const question = QuestionData.getQuestionById(id);
        if (question) {
          favorites.push(question);
        }
      }
    });

    const grouped = {};
    favorites.forEach((q) => {
      if (!grouped[q.category]) {
        grouped[q.category] = [];
      }
      grouped[q.category].push(q);
    });

    return grouped;
  },

  async getWrongQuestions(phone) {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudWrong = await CloudStorage.getWrongQuestions(phone);
        if (cloudWrong !== null) {
          return cloudWrong.map((w) => ({
            id: w.questionId,
            question: w.question,
            answer: w.answer,
            type: w.type,
            category: w.category,
            optionA: w.optionA,
            optionB: w.optionB,
            optionC: w.optionC,
            optionD: w.optionD,
            analysis: w.analysis,
            wrongCount: w.wrongCount,
            correctCount: w.correctCount,
            lastWrong: w.lastWrong,
          }));
        }
      } catch (e) {
        console.warn("云端获取错题列表失败，降级到本地存储");
      }
    }
    const user = await this.getUserByPhone(phone);
    if (!user) return [];
    return user.wrongQuestions || [];
  },

  async addWrongQuestion(phone, question) {
    const user = await this.getUserByPhone(phone);
    if (!user) return false;

    if (!user.wrongQuestions) {
      user.wrongQuestions = [];
    }

    const existingIndex = user.wrongQuestions.findIndex(
      (q) => q.id === question.id
    );

    if (existingIndex >= 0) {
      user.wrongQuestions[existingIndex].wrongCount++;
      user.wrongQuestions[existingIndex].lastWrong = new Date().toISOString();
    } else {
      user.wrongQuestions.push({
        ...question,
        wrongCount: 1,
        correctCount: 0,
        lastWrong: new Date().toISOString(),
      });
    }

    await this.saveUser(user);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.addWrongQuestion(phone, question).catch((e) =>
        console.warn("云端添加错题失败:", e)
      );
    }
    return true;
  },

  async removeWrongQuestion(phone, questionId) {
    const user = await this.getUserByPhone(phone);
    if (!user || !user.wrongQuestions) return false;

    user.wrongQuestions = user.wrongQuestions.filter(
      (q) => q.id !== questionId
    );
    this.saveUser(user);
    return true;
  },

  async clearWrongQuestions(phone) {
    const user = await this.getUserByPhone(phone);
    if (!user) return false;

    user.wrongQuestions = [];
    await this.saveUser(user);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.clearWrongQuestions(phone).catch((e) =>
        console.warn("云端清空错题失败:", e)
      );
    }
    return true;
  },

  async updateWrongQuestionProgress(phone, questionId, isCorrect) {
    const user = await this.getUserByPhone(phone);
    if (!user || !user.wrongQuestions) return false;

    const question = user.wrongQuestions.find((q) => q.id === questionId);
    if (question) {
      if (isCorrect) {
        question.correctCount++;
      } else {
        question.wrongCount++;
      }
      question.lastPracticed = new Date().toISOString();
      this.saveUser(user);
      return true;
    }
    return false;
  },

  async getActivationCodes() {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudCodes = await CloudStorage.getActivationCodes();
        if (cloudCodes !== null) {
          this.set(this.KEYS.ACTIVATION_CODES, cloudCodes);
          return cloudCodes;
        }
      } catch (e) {
        console.warn("云端获取激活码列表失败，降级到本地存储");
      }
    }
    return this.get(this.KEYS.ACTIVATION_CODES, []);
  },

  async saveActivationCode(code) {
    const codes = await this.getActivationCodes();
    codes.push({
      ...code,
      createdAt: new Date().toISOString(),
      usedCount: 0,
      usedBy: [],
    });
    this.set(this.KEYS.ACTIVATION_CODES, codes);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveActivationCode(code).catch((e) =>
        console.warn("云端保存激活码失败:", e)
      );
    }
    return code;
  },

  async generateCodes(count, options = {}) {
    const codes = [];

    for (let i = 0; i < count; i++) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let codeValue = "";
      for (let j = 0; j < 5; j++) {
        codeValue += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existingCodes = await this.getActivationCodes();
      if (existingCodes.some((c) => c.code === codeValue)) {
        i--;
        continue;
      }

      const validityDays = options.validityDays || 30;
      const maxUses = options.maxUses || 1;

      codes.push({
        code: codeValue,
        validityDays,
        maxUses,
        status: "unused",
        createdAt: new Date().toISOString(),
        usedCount: 0,
        usedBy: [],
        expiresAt: new Date(
          Date.now() + validityDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        isSpecial: false,
      });
    }

    const allCodes = await this.getActivationCodes();
    allCodes.push(...codes);
    this.set(this.KEYS.ACTIVATION_CODES, allCodes);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.generateCodes(count, options).catch((e) =>
        console.warn("云端生成激活码失败:", e)
      );
    }

    return codes;
  },

  async validateCode(codeValue) {
    const specialCode = "89757";

    if (codeValue === specialCode) {
      return {
        valid: true,
        code: {
          code: specialCode,
          validityDays: 365,
          maxUses: 0,
          status: "unused",
          isSpecial: true,
          expiresAt: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      };
    }

    const codes = await this.getActivationCodes();
    const code = codes.find((c) => c.code === codeValue);

    if (!code) {
      return { valid: false, message: "激活码不存在" };
    }

    if (
      code.status === "used" &&
      code.maxUses > 0 &&
      code.usedCount >= code.maxUses
    ) {
      return { valid: false, message: "激活码已超过使用次数限制" };
    }

    if (new Date(code.expiresAt) < new Date()) {
      return { valid: false, message: "激活码已过期" };
    }

    return { valid: true, code };
  },

  async useCode(codeValue, phone) {
    const specialCode = "89757";

    if (codeValue === specialCode) {
      return { success: true, isSpecial: true };
    }

    const codes = await this.getActivationCodes();
    const index = codes.findIndex((c) => c.code === codeValue);

    if (index === -1) return { success: false, message: "激活码不存在" };

    const code = codes[index];

    if (new Date(code.expiresAt) < new Date()) {
      return { success: false, message: "激活码已过期" };
    }

    if (code.maxUses > 0 && code.usedCount >= code.maxUses) {
      return { success: false, message: "激活码已超过使用次数限制" };
    }

    codes[index].usedCount++;
    codes[index].lastUsedAt = new Date().toISOString();
    codes[index].usedBy.push({
      phone,
      usedAt: new Date().toISOString(),
    });

    if (code.maxUses > 0 && codes[index].usedCount >= code.maxUses) {
      codes[index].status = "used";
    }

    this.set(this.KEYS.ACTIVATION_CODES, codes);
    return { success: true };
  },

  async deleteCode(codeValue) {
    const codes = await this.getActivationCodes();
    const filteredCodes = codes.filter((c) => c.code !== codeValue);
    this.set(this.KEYS.ACTIVATION_CODES, filteredCodes);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.deleteCode(codeValue).catch((e) =>
        console.warn("云端删除激活码失败:", e)
      );
    }
    return true;
  },

  async clearAllCodes() {
    this.set(this.KEYS.ACTIVATION_CODES, []);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.clearAllCodes().catch((e) =>
        console.warn("云端清空激活码失败:", e)
      );
    }
    return true;
  },

  async getSettings() {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudSettings = await CloudStorage.getSettings();
        if (cloudSettings !== null) {
          const settings = {
            siteName: cloudSettings.siteName || "水知晴体育国职模拟考试系统",
            siteTitle: cloudSettings.siteTitle || "水知晴体育国职模拟考试系统",
            examInfo: cloudSettings.examInfo || {
              考试类型: "国职游泳救生员（初级/中级/高级）",
              考试时间: "每月第二周周六",
              考试地点: "各省市体育职业鉴定站",
              招聘岗位: "救生员、游泳教练员",
            },
            adminPassword: cloudSettings.adminPassword || "89757",
            wrongThreshold: cloudSettings.wrongThreshold || 3,
            logoUrl: cloudSettings.logoUrl || "image/logo.png",
          };
          this.set(this.KEYS.SETTINGS, settings);
          return settings;
        }
      } catch (e) {
        console.warn("云端获取设置失败，降级到本地存储");
      }
    }
    const storedSettings = this.get(this.KEYS.SETTINGS, null);
    if (!storedSettings) {
      return {
        siteName: "水知晴体育国职模拟考试系统",
        siteTitle: "水知晴体育国职模拟考试系统",
        examInfo: {
          考试类型: "国职游泳救生员（初级/中级/高级）",
          考试时间: "每月第二周周六",
          考试地点: "各省市体育职业鉴定站",
          招聘岗位: "救生员、游泳教练员",
        },
        adminPassword: "89757",
        wrongThreshold: 3,
        logoUrl: "image/logo.png",
      };
    }
    return {
      siteName: storedSettings.siteName || "水知晴体育国职模拟考试系统",
      siteTitle: storedSettings.siteTitle || "水知晴体育国职模拟考试系统",
      examInfo: storedSettings.examInfo || {
        考试类型: "国职游泳救生员（初级/中级/高级）",
        考试时间: "每月第二周周六",
        考试地点: "各省市体育职业鉴定站",
        招聘岗位: "救生员、游泳教练员",
      },
      adminPassword: storedSettings.adminPassword || "89757",
      wrongThreshold: storedSettings.wrongThreshold || 3,
      logoUrl: storedSettings.logoUrl || "image/logo.png",
    };
  },

  async saveSettings(settings) {
    const currentSettings = this.getSettings();
    const newSettings = { ...currentSettings, ...settings };
    this.set(this.KEYS.SETTINGS, newSettings);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveSettings(newSettings).catch((e) =>
        console.warn("云端保存设置失败:", e)
      );
    }
    return true;
  },

  updateLogo(logoData) {
    const settings = this.getSettings();
    settings.logoUrl = logoData;
    this.saveSettings(settings);
    return true;
  },

  getTempProgress() {
    return this.get(this.KEYS.TEMP_PROGRESS, null);
  },

  saveTempProgress(progress) {
    this.set(this.KEYS.TEMP_PROGRESS, progress);
    return true;
  },

  clearTempProgress() {
    this.remove(this.KEYS.TEMP_PROGRESS);
    return true;
  },

  async getQuestions() {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudQuestions = await CloudStorage.getQuestions();
        if (cloudQuestions !== null && cloudQuestions.length > 0) {
          const questions = cloudQuestions.map((q) => ({
            id: q.id,
            number: q.number,
            type: q.type,
            category: q.category,
            subCategory: q.subCategory,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            answer: q.answer,
            analysis: q.analysis,
          }));
          this.set(this.KEYS.QUESTIONS, questions);
          return questions;
        }
      } catch (e) {
        console.warn("云端获取题库失败，降级到本地存储");
      }
    }
    return this.get(this.KEYS.QUESTIONS, []);
  },

  async saveQuestions(questions) {
    this.set(this.KEYS.QUESTIONS, questions);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveQuestions(questions).catch((e) =>
        console.warn("云端保存题库失败:", e)
      );
    }
    return true;
  },

  async clearQuestions() {
    this.set(this.KEYS.QUESTIONS, []);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.clearQuestions().catch((e) =>
        console.warn("云端清空题库失败:", e)
      );
    }
    return true;
  },

  async getProgressRecords(phone) {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudRecords = await CloudStorage.getProgressRecords(phone);
        if (cloudRecords !== null) {
          const records = cloudRecords.map((r) => ({
            id: r.objectId,
            phone: r.phone,
            userName: r.userName,
            mode: r.mode,
            category: r.category,
            totalQuestions: r.totalQuestions,
            answeredCount: r.answeredCount,
            correctCount: r.correctCount,
            score: r.score,
            savedAt: r.savedAt,
          }));
          this.set(this.KEYS.PROGRESS_RECORDS, records);
          return records;
        }
      } catch (e) {
        console.warn("云端获取进度记录失败，降级到本地存储");
      }
    }
    const allRecords = this.get(this.KEYS.PROGRESS_RECORDS, []);
    return allRecords.filter((r) => r.phone === phone);
  },

  async saveProgressRecord(phone, record) {
    const records = await this.getProgressRecords(phone);
    records.unshift({
      ...record,
      phone: phone,
      savedAt: new Date().toISOString(),
    });
    this.set(this.KEYS.PROGRESS_RECORDS, records);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.saveProgressRecord(phone, record).catch((e) =>
        console.warn("云端保存进度记录失败:", e)
      );
    }
    return record;
  },

  async deleteProgressRecord(phone, recordId) {
    const records = await this.getProgressRecords(phone);
    const filteredRecords = records.filter((r) => r.id !== recordId);
    this.set(this.KEYS.PROGRESS_RECORDS, filteredRecords);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      CloudStorage.deleteProgressRecord(recordId).catch((e) =>
        console.warn("云端删除进度记录失败:", e)
      );
    }
    return true;
  },

  async clearAllProgress(phone) {
    let records = await this.getProgressRecords(phone);
    const filteredRecords = records.filter((r) => r.phone !== phone);
    this.set(this.KEYS.PROGRESS_RECORDS, filteredRecords);

    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      const cloudRecords = await CloudStorage.getProgressRecords(phone);
      for (const record of cloudRecords) {
        CloudStorage.deleteProgressRecord(record.objectId).catch((e) =>
          console.warn("云端删除进度记录失败:", e)
        );
      }
    }
    return true;
  },

  clearTrialProgress() {
    const allRecords = this.get(this.KEYS.PROGRESS_RECORDS, []);
    const trialRecords = allRecords.filter(
      (r) => r.phone && r.phone.startsWith("trial_")
    );
    const trialIds = new Set(trialRecords.map((r) => r.id));
    const filteredRecords = allRecords.filter((r) => !trialIds.has(r.id));
    this.set(this.KEYS.PROGRESS_RECORDS, filteredRecords);
  },

  async getAllUserStats() {
    if (typeof CloudStorage !== "undefined" && CloudConfig.enableCloud) {
      try {
        const cloudStats = await CloudStorage.getAllUserStats();
        if (cloudStats !== null) {
          return cloudStats;
        }
      } catch (e) {
        console.warn("云端获取用户统计失败，降级到本地存储");
      }
    }
    const users = this.getUsers();
    return users.map((user) => {
      const stats = this.getUserStats(user.phone);
      return {
        phone: user.phone,
        name: user.name,
        registerTime: user.registerTime,
        ...stats,
      };
    });
  },

  resetUserData(phone) {
    const user = this.getUserByPhone(phone);
    if (!user) return false;

    user.wrongQuestions = [];
    user.favorites = [];
    this.saveUser(user);

    const allHistory = this.get(this.KEYS.HISTORY, {});
    if (allHistory[phone]) {
      allHistory[phone] = [];
      this.set(this.KEYS.HISTORY, allHistory);
    }

    const allFavorites = this.get(this.KEYS.FAVORITES, {});
    if (allFavorites[phone]) {
      allFavorites[phone] = [];
      this.set(this.KEYS.FAVORITES, allFavorites);
    }

    return true;
  },

  exportUserData(phone) {
    const user = this.getUserByPhone(phone);
    const history = this.getHistory(phone);
    const wrongQuestions = this.getWrongQuestions(phone);
    const favorites = this.getFavorites(phone);

    return {
      user,
      history,
      wrongQuestions,
      favorites,
      exportTime: new Date().toISOString(),
    };
  },

  importUsers(users) {
    const existingUsers = this.getUsers();
    let importCount = 0;
    let skipCount = 0;

    users.forEach((user) => {
      const exists = existingUsers.find((u) => u.phone === user.phone);
      if (!exists) {
        existingUsers.push(user);
        importCount++;
      } else {
        skipCount++;
      }
    });

    this.set(this.KEYS.USERS, existingUsers);
    return { importCount, skipCount };
  },
};

window.Storage = Storage;
