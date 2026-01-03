const CloudStorage = {
  initialized: false,
  initPromise: null,

  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    if (typeof AV === "undefined") {
      console.warn("LeanCloud SDK未加载，使用本地存储");
      return;
    }

    this.initPromise = new Promise((resolve) => {
      AV.init({
        appId: CloudConfig.appId,
        appKey: CloudConfig.appKey,
      });
      this.initialized = true;
      console.log("LeanCloud云存储初始化成功");
      resolve();
    });

    return this.initPromise;
  },

  async ensureInit() {
    if (!CloudConfig.enableCloud) return false;
    await this.init();
    return this.initialized;
  },

  async getUsers() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("User");
      const users = await query.find();
      return users.map((u) => u.toJSON());
    } catch (e) {
      console.warn("获取用户列表失败:", e);
      return null;
    }
  },

  async getUserByPhone(phone) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("User");
      query.equalTo("phone", phone);
      const user = await query.first();
      return user ? user.toJSON() : null;
    } catch (e) {
      console.warn("获取用户失败:", e);
      return null;
    }
  },

  async saveUser(userData) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("User");
      query.equalTo("phone", userData.phone);
      const existing = await query.first();

      if (existing) {
        Object.keys(userData).forEach((key) => {
          existing.set(key, userData[key]);
        });
        await existing.save();
        return existing.toJSON();
      } else {
        const User = AV.Object.extend("User");
        const user = new User();
        Object.keys(userData).forEach((key) => {
          user.set(key, userData[key]);
        });
        await user.save();
        return user.toJSON();
      }
    } catch (e) {
      console.warn("保存用户失败:", e);
      return null;
    }
  },

  async getHistory(phone) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("History");
      query.equalTo("phone", phone);
      query.descending("createdAt");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取历史记录失败:", e);
      return null;
    }
  },

  async saveHistory(phone, historyItem) {
    if (!(await this.ensureInit())) return null;
    try {
      const History = AV.Object.extend("History");
      const history = new History();
      history.set("phone", phone);
      history.set("date", new Date(historyItem.date));
      history.set("totalQuestions", historyItem.totalQuestions);
      history.set("correctCount", historyItem.correctCount);
      history.set("wrongCount", historyItem.wrongCount);
      history.set("score", historyItem.score);
      history.set("timeUsed", historyItem.timeUsed);
      history.set("avgTime", historyItem.avgTime);
      history.set("mode", historyItem.mode);
      history.set("isTrial", historyItem.isTrial || false);

      const questionsData =
        historyItem.questions?.map((q) => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          userAnswer: q.userAnswer,
          type: q.type,
          category: q.category,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          analysis: q.analysis,
        })) || [];
      history.set("questions", questionsData);

      await history.save();
      return true;
    } catch (e) {
      console.warn("保存历史记录失败:", e);
      return false;
    }
  },

  async getFavorites(phone) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Favorite");
      query.equalTo("phone", phone);
      query.descending("createdAt");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取收藏列表失败:", e);
      return null;
    }
  },

  async addFavorite(phone, questionId) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Favorite");
      query.equalTo("phone", phone);
      query.equalTo("questionId", questionId);
      const existing = await query.first();

      if (existing) {
        return true;
      }

      const Favorite = AV.Object.extend("Favorite");
      const favorite = new Favorite();
      favorite.set("phone", phone);
      favorite.set("questionId", questionId);
      favorite.set("createdAt", new Date());
      await favorite.save();
      return true;
    } catch (e) {
      console.warn("添加收藏失败:", e);
      return false;
    }
  },

  async removeFavorite(phone, questionId) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Favorite");
      query.equalTo("phone", phone);
      query.equalTo("questionId", questionId);
      const favorite = await query.first();

      if (favorite) {
        await favorite.destroy();
      }
      return true;
    } catch (e) {
      console.warn("取消收藏失败:", e);
      return false;
    }
  },

  async getWrongQuestions(phone) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("WrongQuestion");
      query.equalTo("phone", phone);
      query.descending("createdAt");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取错题列表失败:", e);
      return null;
    }
  },

  async addWrongQuestion(phone, question) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("WrongQuestion");
      query.equalTo("phone", phone);
      query.equalTo("questionId", question.id);
      const existing = await query.first();

      if (existing) {
        existing.increment("wrongCount");
        existing.set("lastWrong", new Date());
        await existing.save();
        return true;
      }

      const WrongQuestion = AV.Object.extend("WrongQuestion");
      const wrongQ = new WrongQuestion();
      wrongQ.set("phone", phone);
      wrongQ.set("questionId", question.id);
      wrongQ.set("question", question.question);
      wrongQ.set("answer", question.answer);
      wrongQ.set("type", question.type);
      wrongQ.set("category", question.category);
      wrongQ.set("wrongCount", 1);
      wrongQ.set("correctCount", 0);
      wrongQ.set("lastWrong", new Date());

      if (question.optionA) wrongQ.set("optionA", question.optionA);
      if (question.optionB) wrongQ.set("optionB", question.optionB);
      if (question.optionC) wrongQ.set("optionC", question.optionC);
      if (question.optionD) wrongQ.set("optionD", question.optionD);
      if (question.analysis) wrongQ.set("analysis", question.analysis);

      await wrongQ.save();
      return true;
    } catch (e) {
      console.warn("添加错题失败:", e);
      return false;
    }
  },

  async getQuestions() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Question");
      query.ascending("number");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取题库失败:", e);
      return null;
    }
  },

  async saveQuestions(questions) {
    if (!(await this.ensureInit())) return null;
    try {
      const Question = AV.Object.extend("Question");
      const promises = questions.map(async (q) => {
        const query = new AV.Query("Question");
        query.equalTo("question", q.question);
        query.equalTo("answer", q.answer);
        const existing = await query.first();

        if (existing) {
          return null;
        }

        const question = new Question();
        question.set("id", q.id);
        question.set("number", q.number);
        question.set("type", q.type);
        question.set("category", q.category);
        question.set("subCategory", q.subCategory);
        question.set("question", q.question);
        if (q.optionA) question.set("optionA", q.optionA);
        if (q.optionB) question.set("optionB", q.optionB);
        if (q.optionC) question.set("optionC", q.optionC);
        if (q.optionD) question.set("optionD", q.optionD);
        question.set("answer", q.answer);
        if (q.analysis) question.set("analysis", q.analysis);

        return question.save();
      });

      await Promise.all(promises.filter((p) => p !== null));
      return true;
    } catch (e) {
      console.warn("保存题库失败:", e);
      return false;
    }
  },

  async clearQuestions() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Question");
      const results = await query.find();
      await Promise.all(results.map((r) => r.destroy()));
      return true;
    } catch (e) {
      console.warn("清空题库失败:", e);
      return false;
    }
  },

  async getSettings() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Settings");
      query.descending("createdAt");
      const settings = await query.first();
      return settings ? settings.toJSON() : null;
    } catch (e) {
      console.warn("获取设置失败:", e);
      return null;
    }
  },

  async saveSettings(settingsData) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("Settings");
      const existing = await query.first();

      if (existing) {
        Object.keys(settingsData).forEach((key) => {
          existing.set(key, settingsData[key]);
        });
        await existing.save();
        return existing.toJSON();
      } else {
        const Settings = AV.Object.extend("Settings");
        const settings = new Settings();
        Object.keys(settingsData).forEach((key) => {
          settings.set(key, settingsData[key]);
        });
        await settings.save();
        return settings.toJSON();
      }
    } catch (e) {
      console.warn("保存设置失败:", e);
      return null;
    }
  },

  async getActivationCodes() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("ActivationCode");
      query.descending("createdAt");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取激活码列表失败:", e);
      return null;
    }
  },

  async saveActivationCode(codeData) {
    if (!(await this.ensureInit())) return null;
    try {
      const ActivationCode = AV.Object.extend("ActivationCode");
      const code = new ActivationCode();
      code.set("code", codeData.code);
      code.set("validityDays", codeData.validityDays);
      code.set("maxUses", codeData.maxUses);
      code.set("status", codeData.status || "unused");
      code.set("createdAt", new Date());
      code.set("lastUsedAt", null);
      code.set("usedCount", 0);
      code.set("usedBy", []);
      code.set(
        "expiresAt",
        new Date(
          Date.now() + (codeData.validityDays || 30) * 24 * 60 * 60 * 1000
        )
      );
      await code.save();
      return true;
    } catch (e) {
      console.warn("保存激活码失败:", e);
      return false;
    }
  },

  async generateCodes(count, options) {
    if (!(await this.ensureInit())) return null;
    try {
      const codes = [];
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

      for (let i = 0; i < count; i++) {
        let codeValue = "";
        for (let j = 0; j < 5; j++) {
          codeValue += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const codeData = {
          code: codeValue,
          validityDays: options.validityDays || 30,
          maxUses: options.maxUses || 1,
          status: "unused",
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: new Date(
            Date.now() + (options.validityDays || 30) * 24 * 60 * 60 * 1000
          ).toISOString(),
          usedCount: 0,
          usedBy: [],
        };

        await this.saveActivationCode(codeData);
        codes.push(codeData);
      }

      return codes;
    } catch (e) {
      console.warn("生成激活码失败:", e);
      return [];
    }
  },

  async deleteCode(codeValue) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("ActivationCode");
      query.equalTo("code", codeValue);
      const code = await query.first();

      if (code) {
        await code.destroy();
      }
      return true;
    } catch (e) {
      console.warn("删除激活码失败:", e);
      return false;
    }
  },

  async clearAllCodes() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("ActivationCode");
      const results = await query.find();
      await Promise.all(results.map((r) => r.destroy()));
      return true;
    } catch (e) {
      console.warn("清空激活码失败:", e);
      return false;
    }
  },

  async getProgressRecords() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("ProgressRecord");
      query.descending("createdAt");
      const results = await query.find();
      return results.map((r) => r.toJSON());
    } catch (e) {
      console.warn("获取进度记录失败:", e);
      return null;
    }
  },

  async saveProgressRecord(recordData) {
    if (!(await this.ensureInit())) return null;
    try {
      const ProgressRecord = AV.Object.extend("ProgressRecord");
      const record = new ProgressRecord();
      record.set("phone", recordData.phone);
      record.set("userName", recordData.userName);
      record.set("mode", recordData.mode);
      record.set("category", recordData.category);
      record.set("totalQuestions", recordData.totalQuestions);
      record.set("answeredCount", recordData.answeredCount);
      record.set("correctCount", recordData.correctCount);
      record.set("score", recordData.score);
      record.set("savedAt", new Date());
      await record.save();
      return true;
    } catch (e) {
      console.warn("保存进度记录失败:", e);
      return false;
    }
  },

  async deleteProgressRecord(recordId) {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("ProgressRecord");
      query.equalTo("objectId", recordId);
      const record = await query.first();

      if (record) {
        await record.destroy();
      }
      return true;
    } catch (e) {
      console.warn("删除进度记录失败:", e);
      return false;
    }
  },

  async getAllUserStats() {
    if (!(await this.ensureInit())) return null;
    try {
      const query = new AV.Query("User");
      const users = await query.find();
      const statsList = [];

      for (const user of users) {
        const userData = user.toJSON();
        const phone = userData.phone;

        const historyQuery = new AV.Query("History");
        historyQuery.equalTo("phone", phone);
        const history = await historyQuery.find();

        let totalQuestions = 0;
        let totalCorrect = 0;

        history.forEach((h) => {
          const hData = h.toJSON();
          totalQuestions += hData.totalQuestions || 0;
          totalCorrect += hData.correctCount || 0;
        });

        statsList.push({
          phone: phone,
          name: userData.name,
          registerTime: userData.registerTime,
          totalQuestions: totalQuestions,
          correctCount: totalCorrect,
          wrongCount: totalQuestions - totalCorrect,
          accuracy:
            totalQuestions > 0
              ? Math.round((totalCorrect / totalQuestions) * 100)
              : 0,
          historyCount: history.length,
        });
      }

      return statsList;
    } catch (e) {
      console.warn("获取用户统计失败:", e);
      return null;
    }
  },
};

window.CloudStorage = CloudStorage;
