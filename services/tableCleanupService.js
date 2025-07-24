const Game = require('../models/Game');

class TableCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.INACTIVE_TABLE_TIMEOUT = 5 * 60 * 1000; // 5 phút
    this.MIN_PLAYERS_REQUIRED = 2;
    this.totalCleanupsPerformed = 0;
    this.lastCleanupTime = null;
    this.startTime = null;
    this.isRunning = false;
  }

  // Bắt đầu service cleanup
  start() {
    if (this.cleanupInterval) {
      console.log('🧹 Table cleanup service is already running');
      return;
    }

    console.log('🧹 Starting table cleanup service - checking every 30 seconds');
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Chạy cleanup ngay lập tức
    this.cleanupInactiveTables();
    
    // Sau đó chạy mỗi 30 giây
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveTables();
    }, 30000); // 30 giây
  }

  // Dừng service
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.isRunning = false;
      console.log('🧹 Table cleanup service stopped');
    }
  }

  // Cleanup các bàn không hoạt động
  async cleanupInactiveTables() {
    try {
      this.lastCleanupTime = Date.now();
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - this.INACTIVE_TABLE_TIMEOUT);

      // Tìm các bàn cần xóa:
      // 1. Bàn được tạo từ 5 phút trước
      // 2. Có ít hơn 2 người chơi
      // 3. Vẫn đang ở trạng thái waiting
      const inactiveTables = await Game.find({
        $and: [
          { createdAt: { $lt: cutoffTime } }, // Tạo từ 5 phút trước
          { $expr: { $lt: [{ $size: "$currentPlayers" }, this.MIN_PLAYERS_REQUIRED] } }, // < 2 players
          { gameState: 'waiting' } // Chưa bắt đầu game
        ]
      });

      if (inactiveTables.length > 0) {
        console.log(`🗑️ Found ${inactiveTables.length} inactive tables to cleanup:`);
        
        for (const table of inactiveTables) {
          console.log(`   - "${table.tableName}" (${table.tableId}) - ${table.currentPlayers.length} players`);
        }

        // Xóa các bàn không hoạt động
        const deleteResult = await Game.deleteMany({
          _id: { $in: inactiveTables.map(t => t._id) }
        });

        this.totalCleanupsPerformed += deleteResult.deletedCount;
        console.log(`✅ Cleaned up ${deleteResult.deletedCount} inactive tables`);
        
        return {
          deleted: deleteResult.deletedCount,
          tables: inactiveTables.map(t => ({
            id: t.tableId,
            name: t.tableName,
            players: t.currentPlayers.length
          }))
        };
      } else {
        console.log('🧹 No inactive tables found');
        return { deleted: 0, tables: [] };
      }

    } catch (error) {
      console.error('❌ Error during table cleanup:', error);
      return { error: error.message };
    }
  }

  // Cập nhật lastActivity cho bàn chơi
  async updateTableActivity(tableId) {
    try {
      await Game.findOneAndUpdate(
        { tableId },
        { lastActivity: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error(`❌ Error updating table activity for ${tableId}:`, error);
    }
  }

  // Manual cleanup trigger for admin
  async manualCleanup() {
    console.log('🔧 Manual cleanup triggered by admin');
    const result = await this.cleanupInactiveTables();
    return {
      tablesDeleted: result.deleted || 0,
      deletedTables: result.tables || [],
      timestamp: new Date(),
      type: 'manual'
    };
  }

  // Get service status for admin
  getServiceStatus() {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      lastCleanupTime: this.lastCleanupTime ? new Date(this.lastCleanupTime) : null,
      totalCleanupsPerformed: this.totalCleanupsPerformed,
      nextCleanupIn: this.isRunning ? 30000 - (Date.now() - (this.lastCleanupTime || this.startTime)) : null,
      inactiveThresholdMs: this.INACTIVE_TABLE_TIMEOUT,
      minPlayersRequired: this.MIN_PLAYERS_REQUIRED
    };
  }

  // Lấy thống kê cleanup
  async getCleanupStats() {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - this.INACTIVE_TABLE_TIMEOUT);

      const totalTables = await Game.countDocuments();
      const inactiveTables = await Game.countDocuments({
        $and: [
          { createdAt: { $lt: cutoffTime } },
          { $expr: { $lt: [{ $size: "$currentPlayers" }, this.MIN_PLAYERS_REQUIRED] } },
          { gameState: 'waiting' }
        ]
      });

      const activeTables = await Game.countDocuments({
        $or: [
          { $expr: { $gte: [{ $size: "$currentPlayers" }, this.MIN_PLAYERS_REQUIRED] } },
          { gameState: { $ne: 'waiting' } }
        ]
      });

      return {
        isRunning: this.isRunning,
        totalTables,
        activeTables,
        inactiveTables,
        totalCleanupsPerformed: this.totalCleanupsPerformed,
        lastCleanupTime: this.lastCleanupTime ? new Date(this.lastCleanupTime) : null,
        nextCleanup: this.isRunning ? '30 seconds' : 'Service not running',
        thresholdMinutes: this.INACTIVE_TABLE_TIMEOUT / (60 * 1000),
        minPlayersRequired: this.MIN_PLAYERS_REQUIRED
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new TableCleanupService();
