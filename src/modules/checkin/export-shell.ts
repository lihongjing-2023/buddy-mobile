/**
 * 签到任务 Shell 脚本导出模块
 * 生成可在 Linux 下运行的 Shell 脚本，支持定时签到任务
 */

import type { WorkbuddyAccount } from '@/modules/core/types';
import { API_ENDPOINTS } from '@/modules/core/constants';

/**
 * Shell 脚本导出结果
 */
export interface ShellExportResult {
  /** 生成的脚本内容 */
  script: string;
  /** 建议的文件名 */
  filename: string;
  /** 账号数量 */
  accountCount: number;
}

/**
 * 生成 Linux Shell 脚本
 * @param accounts 导出的账号列表
 * @param hour 签到时间-小时 (0-23)
 * @param minute 签到时间-分钟 (0-59)
 */
export function generateCheckinShellScript(
  accounts: WorkbuddyAccount[],
  hour: number,
  minute: number,
): ShellExportResult {
  if (!accounts || accounts.length === 0) {
    throw new Error('没有可导出的账号');
  }

  if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
    throw new Error('时间格式错误，请使用有效的小时(0-23)和分钟(0-59)');
  }

  const checkinTime = `${hour}:${String(minute).padStart(2, '0')}`;
  const fileName = 'cockpit-checkin.sh';
  const enableLogging = true;
  const logPath = './cockpit-checkin.log';
  const randomDelay = true;

  // 构建账号数据（只包含必要字段）
  const accountData = accounts.map((acc) => ({
    id: acc.id,
    email: acc.email,
    access_token: acc.access_token,
    domain: acc.domain || '',
    uid: acc.uid || '',
    enterprise_id: acc.enterprise_id || '',
    tenant_id: acc.tenant_id || '',
  }));

  const accountsJson = JSON.stringify(accountData, null, 2);

  const scriptContent = `#!/bin/bash
# ============================================================
# Cockpit Tools - 签到任务自动化脚本
# 生成时间: ${new Date().toISOString()}
# 账号数量: ${accounts.length}
# 签到时间: ${checkinTime} (每天)
# ⚠️  安全提醒: 本脚本以明文存储 access_token，请妥善保管
#     建议设置文件权限: chmod 600 \$(basename \$0)
#     Token 过期后需重新导出脚本
# ============================================================

# 配置参数
CHECKIN_TIME="${checkinTime}"
LOG_FILE="${logPath}"
ENABLE_LOGGING=${enableLogging}
RANDOM_DELAY=${randomDelay}

# 从 CHECKIN_TIME 提取小时和分钟
HOUR=$(echo "${CHECKIN_TIME}" | cut -d: -f1)
MINUTE=$(echo "${CHECKIN_TIME}" | cut -d: -f2)

# API 端点
API_BASE="${API_ENDPOINTS.BASE}"
CHECKIN_API="${API_ENDPOINTS.DAILY_CHECKIN}"

# 颜色输出
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

# 账号数据（JSON格式）
ACCOUNTS_JSON='${accountsJson.replace(/'/g, "'\\''")}'

# 日志函数
log_message() {
    local message="\$1"
    if [ "\$ENABLE_LOGGING" = true ]; then
        local timestamp=\$(date '+%Y-%m-%d %H:%M:%S')
        echo "[\${timestamp}] \${message}" >> "\$LOG_FILE"
    fi
    echo -e "\${message}"
}

# 执行单个账号签到
perform_checkin() {
    local email="\$1"
    local access_token="\$2"
    local domain="\$3"
    local uid="\$4"
    local enterprise_id="\$5"
    local tenant_id="\$6"

    # 构建 curl 命令
    local response
    response=\$(curl -s -w "\\n%{http_code}" -X POST "\${API_BASE}\${CHECKIN_API}" \\
        -H "Authorization: Bearer \${access_token}" \\
        -H "Content-Type: application/json" \\
        -H "X-Domain: \${domain}" \\
        -H "X-User-Id: \${uid}" \\
        -H "X-Enterprise-Id: \${enterprise_id}" \\
        -H "X-Tenant-Id: \${tenant_id}" \\
        -d '{}' 2>/dev/null)

    local http_code=\$(echo "\${response}" | tail -1)
    local body=\$(echo "\${response}" | sed '\$d')

    if [ "\${http_code}" = "200" ] || [ "\${http_code}" = "0" ]; then
        # 使用 Python 解析 JSON 响应
        local success=\$(echo "\${body}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    result = data.get('data', {}).get('success', False)
    print('true' if result else 'false')
except:
    print('false')
" 2>/dev/null || echo "false")

        local message=\$(echo "\${body}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('data', {}).get('message', ''))
except:
    print('')
" 2>/dev/null || echo "")

        local reward=\$(echo "\${body}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('data', {}).get('reward', 0))
except:
    print(0)
" 2>/dev/null || echo "0")

        if [ "\${success}" = "true" ]; then
            log_message "\${GREEN}[✓]\${NC} \${email}: 签到成功! \${message} (+\${reward}积分)"
            return 0
        else
            log_message "\${YELLOW}[!]\${NC} \${email}: \${message:-签到失败}"
            return 1
        fi
    else
        log_message "\${RED}[✗]\${NC} \${email}: HTTP \${http_code} - 请求失败"
        return 1
    fi
}

# 主执行函数
main() {
    log_message "========================================"
    log_message "开始执行每日签到任务"
    log_message "账号数量: \$(echo "\${ACCOUNTS_JSON}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")"
    log_message "========================================"

    local success_count=0
    local fail_count=0
    local total_count=0

    # 获取账号数量
    local account_count=\$(echo "\${ACCOUNTS_JSON}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

    for i in \$(seq 0 \$((account_count - 1))); do
        # 提取账号信息
        local account_info=\$(echo "\${ACCOUNTS_JSON}" | python3 -c "
import sys, json
accounts = json.load(sys.stdin)
acc = accounts[\${i}]
print(f\"{acc['email']}|{acc['access_token']}|{acc['domain']}|{acc['uid']}|{acc['enterprise_id']}|{acc['tenant_id']}\")
" 2>/dev/null)

        if [ -z "\${account_info}" ]; then
            log_message "\${RED}[✗]\${NC} 无法解析账号信息"
            continue
        fi

        IFS='|' read -r email access_token domain uid enterprise_id tenant_id <<< "\${account_info}"

        total_count=\$((total_count + 1))

        # 随机延迟（避免同时请求被限流）
        if [ "\${RANDOM_DELAY}" = true ] && [ \$i -gt 0 ]; then
            local delay=\$((RANDOM % 5 + 2))  # 2-6秒随机延迟
            log_message "等待 \${delay} 秒后处理下一个账号..."
            sleep \$delay
        fi

        # 执行签到
        if perform_checkin "\${email}" "\${access_token}" "\${domain}" "\${uid}" "\${enterprise_id}" "\${tenant_id}"; then
            success_count=\$((success_count + 1))
        else
            fail_count=\$((fail_count + 1))
        fi
    done

    # 统计结果
    log_message "========================================"
    log_message "签到任务完成!"
    log_message "成功: \${success_count}/\${total_count}"
    log_message "失败: \${fail_count}/\${total_count}"
    log_message "========================================"
}

# 命令行参数处理
case "\${1}" in
    --now|-n)
        # 立即执行
        main
        ;;
    --help|-h)
        echo "用法: \$0 [选项]"
        echo "选项:"
        echo "  -n, --now     立即执行签到"
        echo "  -h, --help    显示此帮助信息"
        echo ""
        echo "定时执行: 脚本已配置每天 \${CHECKIN_TIME} 自动执行"
        echo "日志文件: \${LOG_FILE}"
        ;;
    --install-cron|-c)
        # 安装到 crontab
        if command -v crontab &> /dev/null; then
            existing_cron=\$(crontab -l 2>/dev/null | grep -F "cockpit-checkin" || true)
            
            if [ -z "\${existing_cron}" ]; then
                log_message "设置定时任务: 每天 \${CHECKIN_TIME} 执行"
                (crontab -l 2>/dev/null; echo "\${MINUTE} \${HOUR} * * * cd \$(pwd) && bash \$(basename \${0}) >> \${LOG_FILE} 2>&1") | crontab -
                log_message "定时任务已添加到 crontab"
            else
                log_message "定时任务已存在"
            fi
        else
            log_message "\${YELLOW}[!]\${NC} 未找到 crontab，请手动设置定时任务"
            log_message "建议的 crontab 配置:"
            log_message "\${MINUTE} \${HOUR} * * * cd /path/to/script && bash cockpit-checkin.sh >> \${LOG_FILE} 2>&1"
        fi
        ;;
    *)
        # 默认：显示配置信息
        log_message "Cockpit Tools - 签到任务脚本"
        log_message ""
        log_message "配置信息:"
        log_message "  签到时间: \${CHECKIN_TIME}"
        log_message "  账号数量: \$(echo "\${ACCOUNTS_JSON}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")"
        log_message "  日志文件: \${LOG_FILE}"
        log_message ""
        log_message "使用方法:"
        log_message "  立即执行: bash \$(basename \${0}) --now"
        log_message "  安装定时: bash \$(basename \${0}) --install-cron"
        log_message "  查看帮助: bash \$(basename \${0}) --help"
        ;;
esac
  }

  return {
    script: scriptContent,
    filename: fileName,
    accountCount: accounts.length,
  };
}

