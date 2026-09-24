import { storage } from '../../core/storage.js'
import { STORAGE_KEYS, MEMBER_COLORS } from '../../core/constants.js'
import { uid } from '../../core/utils.js'
import { loadTransactions, saveTransactions } from './transactionController.js'

// 删除成员时，其名下历史账单的处理方式
export const DELETE_ACTIONS = {
  REASSIGN: 'reassign', // 转移给其他成员（账单保留）
  UNASSIGNED: 'unassigned' // 保留账单，标记为“未分配”
}

export function loadMembers() {
  return storage.getJSON(STORAGE_KEYS.members) || []
}

export function saveMembers(members) {
  storage.setJSON(STORAGE_KEYS.members, members)
}

export function activeMembers(members = loadMembers()) {
  return members.filter((m) => m.active !== false)
}

export function memberName(memberId, members = loadMembers()) {
  if (!memberId) return '未分配'
  return members.find((m) => m.id === memberId)?.name || '未分配'
}

export function memberById(memberId, members = loadMembers()) {
  return members.find((m) => m.id === memberId) || null
}

// 该成员名下仍保留的账单数量（含未分配，用于删除前提示）
export function countTransactionsOf(memberId) {
  return loadTransactions().filter((t) => t.memberId === memberId).length
}

function nextColor(members) {
  return MEMBER_COLORS[members.length % MEMBER_COLORS.length]
}

export function addMember(input) {
  const members = loadMembers()
  const name = String(input.name || '').trim()
  if (!name) return { ok: false, message: '请填写成员姓名' }
  if (members.some((m) => m.name === name)) return { ok: false, message: '已存在同名成员' }
  const member = {
    id: uid(),
    name,
    role: String(input.role || '其他').trim() || '其他',
    color: input.color || nextColor(members),
    active: true,
    createdAt: new Date().toISOString()
  }
  saveMembers([...members, member])
  return { ok: true, member }
}

export function updateMember(id, input) {
  const members = loadMembers()
  const name = String(input.name || '').trim()
  if (!name) return { ok: false, message: '请填写成员姓名' }
  if (members.some((m) => m.id !== id && m.name === name)) return { ok: false, message: '已存在同名成员' }
  saveMembers(
    members.map((m) =>
      m.id === id ? { ...m, name, role: String(input.role || '其他').trim() || '其他', color: input.color || m.color } : m
    )
  )
  return { ok: true }
}

export function setMemberActive(id, active) {
  const members = loadMembers()
  const target = members.find((m) => m.id === id)
  if (!target) return { ok: false, message: '成员不存在' }
  // 至少保留一位启用成员，否则新账单将无人可归属
  if (!active && target.active !== false && activeMembers(members).length <= 1) {
    return { ok: false, message: '至少需要保留一位启用中的成员' }
  }
  saveMembers(members.map((m) => (m.id === id ? { ...m, active: Boolean(active) } : m)))
  return { ok: true }
}

export function deleteMember(id, { action = DELETE_ACTIONS.UNASSIGNED, reassignTo = '' } = {}) {
  const members = loadMembers()
  const target = members.find((m) => m.id === id)
  if (!target) return { ok: false, message: '成员不存在' }

  const txCount = countTransactionsOf(id)
  let targetMemberId = ''
  if (txCount > 0) {
    if (action === DELETE_ACTIONS.REASSIGN) {
      targetMemberId = activeMembers(members).find((m) => m.id === reassignTo)?.id
      if (!targetMemberId) return { ok: false, message: '请选择账单要转移给哪位成员' }
    }
    const transactions = loadTransactions().map((t) =>
      t.memberId === id ? { ...t, memberId: action === DELETE_ACTIONS.REASSIGN ? targetMemberId : '' } : t
    )
    saveTransactions(transactions)
  }

  saveMembers(members.filter((m) => m.id !== id))
  return { ok: true, txCount, reassignTo: targetMemberId }
}

// 老版本数据迁移：首次存在账单但没有成员数据时，补一位默认成员并承接历史账单
export function ensureMembers() {
  let members = loadMembers()
  if (members.length) return members
  const fallback = {
    id: uid(),
    name: '我',
    role: '户主',
    color: MEMBER_COLORS[0],
    active: true,
    createdAt: new Date().toISOString()
  }
  const transactions = loadTransactions().map((t) => (t.memberId ? t : { ...t, memberId: fallback.id }))
  saveTransactions(transactions)
  saveMembers([fallback])
  return [fallback]
}
