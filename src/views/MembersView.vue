<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>家庭成员</h2>
        <p class="page-sub">管理成员资料，账单可归属到具体的人</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">＋ 添加成员</button>
    </div>

    <div class="card member-grid">
      <div v-for="m in memberRows" :key="m.id" class="member-row" :class="{ off: !isActive(m) }">
        <div class="member-avatar" :style="{ background: m.color }">{{ m.name.slice(0, 1) }}</div>
        <div class="member-info">
          <div class="member-name-line">
            <b>{{ m.name }}</b>
            <span v-if="!isActive(m)" class="tag tag-off">已停用</span>
          </div>
          <div class="member-role">{{ m.role }}</div>
          <div class="member-stat">
            共 {{ m.txCount }} 笔记账单 · 本月支出 ¥{{ money(m.monthExpense) }}
          </div>
        </div>
        <div class="member-actions">
          <button class="btn btn-sm" @click="openEdit(m)">编辑</button>
          <button class="btn btn-sm" @click="toggleActive(m)">{{ isActive(m) ? '停用' : '启用' }}</button>
          <button class="btn btn-sm btn-danger" @click="openDelete(m)">删除</button>
        </div>
      </div>
      <div v-if="memberRows.length === 0" class="empty">还没有成员，点击右上角添加第一位家庭成员</div>
    </div>

    <p class="tips">
      停用成员后不能再为新账单选择该成员，但其历史账单会完整保留；排行榜只统计启用中的成员。
    </p>

    <!-- 新增 / 编辑成员 -->
    <Modal :title="editingId ? '编辑成员' : '添加成员'" v-if="formOpen" @close="formOpen = false">
      <form id="member-form" @submit.prevent="submitForm" class="form">
        <label class="field">
          <span>姓名</span>
          <input v-model="form.name" maxlength="12" required placeholder="例如：张先生" />
        </label>
        <label class="field">
          <span>身份</span>
          <select v-model="form.role">
            <option v-for="r in MEMBER_ROLES" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <div class="field">
          <span>头像颜色</span>
          <div class="color-row">
            <button
              v-for="c in MEMBER_COLORS"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ picked: form.color === c }"
              :style="{ background: c }"
              @click="form.color = c"
              :aria-label="c"
            ></button>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn" @click="formOpen = false">取消</button>
        <button type="submit" class="btn btn-primary" form="member-form">保存</button>
      </template>
    </Modal>

    <!-- 删除成员 -->
    <Modal :title="'删除成员'" v-if="deleteTarget" @close="deleteTarget = null">
      <div class="del-box">
        <p class="del-lead">
          确定删除成员 <b>{{ deleteTarget.name }}</b> 吗？此操作不可恢复。
        </p>
        <template v-if="deleteTxCount > 0">
          <p class="del-warn">
            该成员名下有 <b>{{ deleteTxCount }}</b> 笔历史账单。账单本身不会被删除，请选择这些记录的处理方式：
          </p>
          <label class="radio-row" v-if="reassignCandidates.length">
            <input type="radio" v-model="deleteAction" :value="DELETE_ACTIONS.REASSIGN" />
            <span>
              转移给其他成员，账单继续参与该成员的统计与排行：
              <select v-model="reassignTo" :disabled="deleteAction !== DELETE_ACTIONS.REASSIGN" class="inline-select">
                <option value="" disabled>选择成员</option>
                <option v-for="c in reassignCandidates" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </span>
          </label>
          <label class="radio-row">
            <input type="radio" v-model="deleteAction" :value="DELETE_ACTIONS.UNASSIGNED" />
            <span>保留账单但标记为“未分配”，不再计入任何成员的统计与排行</span>
          </label>
        </template>
        <p v-else class="del-muted">该成员名下没有历史账单，可直接删除。</p>
      </div>
      <template #footer>
        <button type="button" class="btn" @click="deleteTarget = null">取消</button>
        <button type="button" class="btn btn-danger" @click="confirmDelete">确认删除</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useStore, refreshKeys, controllersApi } from '../data/store.js'
import { money } from '../core/utils.js'
import { MEMBER_ROLES, MEMBER_COLORS } from '../core/constants.js'
import Modal from '../components/Modal.vue'

const store = useStore()
const { member: memberApi } = controllersApi
const DELETE_ACTIONS = memberApi.DELETE_ACTIONS

const isActive = (m) => m.active !== false

const currentMonth = () => new Date().toISOString().slice(0, 7)

const memberRows = computed(() => {
  const month = currentMonth()
  return [...store.members]
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
    .map((m) => {
      const txs = store.transactions.filter((t) => t.memberId === m.id)
      return {
        ...m,
        txCount: txs.length,
        monthExpense: txs.filter((t) => t.type === 'expense' && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0)
      }
    })
})

// ---------- 新增 / 编辑 ----------
const formOpen = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', role: MEMBER_ROLES[0], color: MEMBER_COLORS[0] })

const openCreate = () => {
  editingId.value = null
  Object.assign(form, {
    name: '',
    role: MEMBER_ROLES[0],
    color: MEMBER_COLORS[store.members.length % MEMBER_COLORS.length]
  })
  formOpen.value = true
}

const openEdit = (m) => {
  editingId.value = m.id
  Object.assign(form, { name: m.name, role: m.role, color: m.color })
  formOpen.value = true
}

const submitForm = () => {
  const result = editingId.value ? memberApi.updateMember(editingId.value, form) : memberApi.addMember(form)
  if (!result.ok) {
    alert(result.message)
    return
  }
  refreshKeys('members')
  formOpen.value = false
}

const toggleActive = (m) => {
  if (isActive(m)) {
    if (!confirm(`停用后，新账单将不能选择「${m.name}」，其历史账单仍会保留。确认停用？`)) return
  }
  const result = memberApi.setMemberActive(m.id, !isActive(m))
  if (!result.ok) alert(result.message)
  refreshKeys('members')
}

// ---------- 删除 ----------
const deleteTarget = ref(null)
const deleteTxCount = ref(0)
const deleteAction = ref(DELETE_ACTIONS.UNASSIGNED)
const reassignTo = ref('')

const reassignCandidates = computed(() =>
  deleteTarget.value ? store.members.filter((m) => m.id !== deleteTarget.value.id && isActive(m)) : []
)

const openDelete = (m) => {
  const activeCount = store.members.filter(isActive).length
  if (isActive(m) && activeCount <= 1) {
    alert('至少需要保留一位启用中的成员，请先添加或启用其他成员。')
    return
  }
  deleteTarget.value = m
  deleteTxCount.value = memberApi.countTransactionsOf(m.id)
  deleteAction.value = DELETE_ACTIONS.UNASSIGNED
  reassignTo.value = reassignCandidates.value[0]?.id || ''
}

const confirmDelete = () => {
  const result = memberApi.deleteMember(deleteTarget.value.id, { action: deleteAction.value, reassignTo: reassignTo.value })
  if (!result.ok) {
    alert(result.message)
    return
  }
  refreshKeys('members', 'transactions')
  deleteTarget.value = null
}
</script>

<style scoped>
.member-grid {
  display: flex;
  flex-direction: column;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border-color);
}
.member-row:last-child {
  border-bottom: none;
}
.member-row.off .member-avatar {
  filter: grayscale(0.7);
  opacity: 0.65;
}
.member-avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  font-weight: 800;
  flex-shrink: 0;
}
.member-info {
  flex: 1;
  min-width: 0;
}
.member-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.member-name-line b {
  font-size: 15px;
}
.tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.tag-off {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
.member-role {
  font-size: 12px;
  color: var(--accent);
  margin-top: 1px;
}
.member-stat {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.member-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 8px;
}
.btn-danger {
  color: var(--expense);
  border-color: rgba(224, 82, 96, 0.35);
}
.btn-danger:hover {
  background: rgba(224, 82, 96, 0.08);
}
.btn.btn-danger.btn-primary,
.btn-primary.btn-danger {
  background: var(--expense);
  border-color: transparent;
  color: #fff;
}
.tips {
  margin: 14px 4px 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.color-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.color-dot.picked {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--card-bg), 0 0 0 4px var(--accent);
}
.del-box {
  font-size: 13px;
}
.del-lead {
  margin: 0 0 10px;
}
.del-warn {
  background: rgba(240, 201, 87, 0.14);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 12px;
  color: #8a6d1a;
}
.del-warn b {
  color: var(--expense);
}
.del-muted {
  margin: 0;
  color: var(--text-secondary);
}
.radio-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0;
  cursor: pointer;
  line-height: 1.6;
}
.radio-row input {
  margin-top: 4px;
}
.inline-select {
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  margin-left: 6px;
}
</style>
