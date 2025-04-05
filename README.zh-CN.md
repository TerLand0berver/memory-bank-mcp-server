# Memory Bank MCP Server

这是一个 Model Context Protocol (MCP) 服务器，用于管理项目特定的“记忆库”数据。它使用 SQLite 数据库来存储和检索与项目相关的上下文信息，如产品背景、决策日志、进度更新等。

## 功能

*   **基于项目:** 为每个指定的项目路径维护一个独立的记忆库。
*   **SQLite 存储:** 在项目目录下的 `memory-bank/memory.db` 文件中存储数据，提供结构化和高效的访问。
*   **模块化:** 将记忆库管理逻辑封装为独立的 MCP 服务。
*   **标准化接口:** 提供一组 MCP 工具来与记忆库交互。

## 使用 npx 运行 (推荐)

此服务器已发布到 npm，可以通过 `npx` 直接运行，无需手动克隆、安装或构建。

## 运行

此服务器设计为通过支持 MCP 的宿主应用程序（如 Roo Code）自动启动和管理。宿主应用程序会根据其配置（例如 `mcp_settings.json`）来运行此服务器。

如果需要手动测试，可以在构建后直接运行编译后的文件：

```bash
node build/index.js
```

服务器将在标准输入/输出 (stdio) 上监听 MCP 消息。

## 集成指南 (使用 npx)

您可以将此 Memory Bank MCP 服务器集成到支持 MCP 的应用程序（如 RooCode）中。推荐使用 `npx` 来运行服务器。

### RooCode 配置示例

1.  打开 RooCode 的 `mcp_settings.json` 配置文件。
2.  在 `servers` 数组中添加一个新的服务器配置条目，如下所示：

    ```json
    {
      "name": "Memory Bank Server (npx)", // 您可以自定义名称
      "command": "npx",
      "args": [
        "-y", // 确保总是使用最新版本或已安装版本
        "@your-npm-username/memory-bank-mcp-server" // 将 @your-npm-username 替换为实际的 npm 用户名或组织名
        // 如果服务器支持，可以在这里添加其他参数，例如 --config path/to/config.json
      ],
      "type": "stdio", // 或根据需要设置为 "sse"
      "alwaysAllow": [ // 列出您希望允许此服务器使用的工具
        "initialize_memory_bank",
        "get_memory_bank_status",
        "read_memory_bank_section",
        "update_memory_bank_entry"
      ],
      "disabled": false // 设置为 false 以启用服务器
    }
    ```
3.  **重要:** 将 `"@your-npm-username/memory-bank-mcp-server"` 中的 `@your-npm-username` 替换为发布此包时使用的实际 npm 用户名或组织名。
4.  保存 `mcp_settings.json` 文件。
5.  重启 RooCode 以加载新的 MCP 服务器。

### 其他 MCP 客户端

对于其他支持 MCP 的客户端，请参考其文档，了解如何配置通过命令行启动的 stdio 或 SSE 类型的 MCP 服务器。通常，您需要提供 `npx` 命令和相应的参数，如上例所示。

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

## 工作原理

下图展示了 Memory Bank MCP 服务器的基本工作流程：

```mermaid
graph TD
    Client["客户端 (如 RooCode)"] -->|1. 发送工具调用请求 (如 read_memory_bank_section)| MCPServer(Memory Bank MCP Server)
    MCPServer -->|2. 解析请求, 调用相应工具| Tools(MCP 工具实现)
    Tools -->|3. 执行数据库操作 (读/写)| SQLiteDB[SQLite 数据库 (.memory_bank/memory_bank.db)]
    SQLiteDB -->|4. 返回数据库结果| Tools
    Tools -->|5. 处理结果| MCPServer
    MCPServer -->|6. 返回响应给客户端| Client
```

1.  **客户端请求:** 支持 MCP 的客户端（如 RooCode）向 Memory Bank 服务器发送一个工具调用请求，指定要执行的操作（如 `read_memory_bank_section`）和必要的参数（如 `project_path`, `section`）。
2.  **服务器处理:** MCP 服务器接收请求，解析它，并调用内部对应的工具函数来处理该请求。
3.  **数据库交互:** 工具函数根据请求类型与项目目录下的 `.memory_bank/memory_bank.db` SQLite 数据库进行交互（查询或修改数据）。
4.  **返回结果:** 数据库操作完成后，结果返回给工具函数。
5.  **响应准备:** 工具函数处理数据库结果，并准备要发送回客户端的响应数据。
6.  **发送响应:** MCP 服务器将包含结果或状态信息的响应发送回客户端。

### 数据库结构 (Database Structure)

记忆库的核心由以下 SQLite 表构成，它们共同存储项目的关键信息：

*   **`product_context`**: 存储关于产品或项目的高级背景信息、目标、范围等。这有助于理解项目的“为什么”。
*   **`decisions`**: 记录重要的技术选型、架构决策、产品方向调整等。包含做出决策的原因、考虑的选项以及最终结果，为未来的回顾提供依据。
*   **`progress`**: 跟踪开发过程中的关键进展、状态更新、已完成的任务或里程碑。这有助于了解项目的“怎么样了”。
*   **`focus`**: 定义当前或近期的开发重点、需要解决的关键问题或需要特别关注的领域。这有助于团队保持方向一致。
*   **`system_patterns`**: 记录在代码库或系统架构中识别出的可重用模式、常见解决方案或重要的设计原则。这有助于知识沉淀和代码一致性。

这些表共同协作，形成了一个动态的项目“记忆库”，捕捉了项目的演变过程和关键知识点。

## 致谢 (Acknowledgements)

此项目的部分设计和灵感来源于 [RooFlow](https://github.com/GreatScottyMac/RooFlow) 项目。感谢其为 MCP 生态和 AI 辅助开发流程提供的思路。
