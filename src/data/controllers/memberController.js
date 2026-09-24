import { storage } from '../../core/storage.js'
import { uid } from '../../core/utils.js'
import { STORAGE_KEYS } from '../../core/constants.js'
import { loadTransactions, saveTransactions, reconcileAll } from './transactionController.js'

// 首次使用（尚未重置过演示数据）时给出的默认家庭
export const DEFAULT_MEMBERS = [
  { name: '张先生', role: '户主' },
  { name: '李女士', role: '配偶' },
  { name: '张小明', role: '孩子' },
  { name: '奶奶', role: '长辈' }
]

export const emptyMemberForm = () => ({
  name: '',
  role: ''
})

export function loadMembers() {
  const saved = storage.getJSON(STORAGE_KEYS.members)
  if (saved) return saved
  // 老用户首次打开：自动建立默认成员（历史账单保持「未归属」）
  const defaults = DEFAULT_MEMBERS.map((m) => normalizeMember(m))
  saveMembers(defaults)
  return defaults
}

export function saveMembers(members) {
  storage.setJSON(STORAGE_KEYS.members, members)
}

export function normalizeMember(form) {
  return {
    id: uid(),
    name: String(form.name || '').trim(),
    role: String(form.role || '').trim(),
    active: true,
    createdAt: Date.now()
  }
}

export function addMember(form) {
  const name = String(form.name || '').trim()
  if (!name) return null
  if (loadMembers().some((m) => m.name === name)) return null
  const member = { ...normalizeMember(form), name }
  saveMembers([...loadMembers(), member])
  return member
}

export function updateMember(id, form) {
  const name = String(form.name || '').trim()
  if (!name) return false
  if (loadMembers().some((m) => m.id !== id && m.name === name)) return false
  const members = loadMembers().map((m) =>
    m.id === id ? { ...m, name, role: String(form.role || '').trim() } : m
  )
  saveMembers(members)
  return true
}

export function setMemberActive(id, active) {
  const members = loadMembers()
  // 至少保留一位启用成员，保证新账单有人可归属
  if (!active && members.filter((m) => m.active).length <= 1) return false
  saveMembers(members.map((m) => (m.id === id ? { ...m, active: Boolean(active) } : m)))
  return true
}

// 统计成员名下的历史账单（停用成员的账单仍保留在这里）
export function countMemberTransactions(memberId) {
  return loadTransactions().filter((t) => t.memberId === memberId).length
}

/**
 * 删除成员
 * @param {'keep'|'unassign'|'delete'} mode
 *   keep     - 保留账单，仍挂在该成员名下（成员名字快照到账单上，显示为「张三（已删除）」）
 *   unassign - 保留账单，但改为「未归属」
 *   delete   - 连同账单一起删除，账户余额自动回滚
 */
export function removeMember(id, mode = 'keep') {
  const member = loadMembers().find((m) => m.id === id)
  if (!member) return false

  let transactions = loadTransactions()
  if (mode === 'delete') {
    transactions = transactions.filter((t) => t.memberId !== id)
    saveTransactions(transactions)
    reconcileAll()
  } else if (mode === 'unassign') {
    transactions = transactions.map((t) => (t.memberId === id ? { ...t, memberId: '' } : t))
    saveTransactions(transactions)
  } else {
    // keep：把姓名快照留在账单上，删除后仍能看到这笔钱原来归属谁
    transactions = transactions.map((t) =>
      t.memberId === id ? { ...t, memberId: '', memberName: member.name } : t
    )
    saveTransactions(transactions)
  }

  saveMembers(loadMembers().filter((m) => m.id !== id))
  return true
}

// 账单归属的显示名称：优先取当前成员名，找不到时用账单上的快照名
export function memberNameOf(members, transaction) {
  const m = (members || []).find((x) => x.id === transaction.memberId)
  if (m) return { name: m.name, deleted: false }
  if (transaction.memberName) return { name: `${transaction.memberName}（已删除）`, deleted: true }
  return { name: '未归属', deleted: false }
}
