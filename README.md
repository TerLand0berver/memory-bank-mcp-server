# Memory Bank MCP Server

这是一个 Model Context Protocol (MCP) 服务器，用于管理项目特定的“记忆库”数据。它使用 SQLite 数据库来存储和检索与项目相关的上下文信息，如产品背景、决策日志、进度更新等。

## 功能

*   **基于项目:** 为每个指定的项目路径维护一个独立的记忆库。
*   **SQLite 存储:** 在项目目录下的 `memory-bank/memory.db` 文件中存储数据，提供结构化和高效的访问。
*   **模块化:** 将记忆库管理逻辑封装为独立的 MCP 服务。
*   **标准化接口:** 提供一组 MCP 工具来与记忆库交互。

## 安装

1.  **克隆/下载:** 获取此服务器的代码。
2.  **安装依赖:** 在服务器的根目录（包含 `package.json` 的目录）运行：
    ```bash
    npm install
    ```

## 构建

要将 TypeScript 代码编译为 JavaScript，请运行：

```bash
npm run build
```

编译后的输出位于 `build/` 目录下。

## 运行

此服务器设计为通过支持 MCP 的宿主应用程序（如 Roo Code）自动启动和管理。宿主应用程序会根据其配置（例如 `mcp_settings.json`）来运行此服务器。

如果需要手动测试，可以在构建后直接运行编译后的文件：

```bash
node build/index.js
```

服务器将在标准输入/输出 (stdio) 上监听 MCP 消息。

## MCP 工具

该服务器提供以下 MCP 工具：

1.  **`initialize_memory_bank`**
    *   **描述:** 初始化指定项目路径的记忆库存储。如果 `memory-bank/` 目录或 `memory.db` 文件不存在，则会创建它们。
    *   **输入:**
        *   `project_path` (string, required): 项目的绝对路径。
    *   **输出:** 包含状态消息和数据库路径的对象。

2.  **`get_memory_bank_status`**
    *   **描述:** 检查指定项目路径的记忆库状态（是否存在数据库文件）。
    *   **输入:**
        *   `project_path` (string, required): 项目的绝对路径。
    *   **输出:** 包含 `exists` (boolean), `db_path` (string) 和 `message` (string) 的对象。

3.  **`read_memory_bank_section`**
    *   **描述:** 从记忆库的特定部分读取条目。
    *   **输入:**
        *   `project_path` (string, required): 项目的绝对路径。
        *   `section` (string, required): 要读取的部分 (例如, `product_context`, `decisions`, `progress`, `focus`, `system_patterns`)。
        *   `limit` (number, optional, default: 10): 返回的最大条目数。
        *   `offset` (number, optional, default: 0): 用于分页的偏移量。
    *   **输出:** 一个包含该部分记录的对象数组。

4.  **`update_memory_bank_entry`**
    *   **描述:** 在记忆库的特定部分添加一个新条目。
    *   **输入:**
        *   `project_path` (string, required): 项目的绝对路径。
        *   `section` (string, required): 要更新的部分 (同上)。
        *   `entry_data` (object, required): 新条目的数据。键应与该部分数据库表的列名匹配（`id` 和 `timestamp` 除外）。
            *   `product_context`: `{ "content": "..." }`
            *   `decisions`: `{ "reason": "...", "outcome": "..." }`
            *   `progress`: `{ "update_summary": "...", "status": "..." }`
            *   `focus`: `{ "area": "...", "details": "..." }`
            *   `system_patterns`: `{ "pattern_name": "...", "description": "..." }`
    *   **输出:** 包含状态消息和新插入条目 ID 的对象。
