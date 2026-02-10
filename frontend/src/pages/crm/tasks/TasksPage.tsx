import * as React from 'react'
import { crmManagerApi } from '@/api/crmManagerApi'

type Manager = {
  id: string
  name?: string
  email?: string
}

type Task = {
  id: string
  task_id?: string
  title: string
  description?: string
  due_at?: string
  completed?: number | boolean
  assigned_to?: string
}

function normalizeTask(task: Task): Task {
  const normalizedId = String(task.id || task.task_id || '')
  return {
    ...task,
    id: normalizedId
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [managers, setManagers] = React.useState<Manager[]>([])
  const [form, setForm] = React.useState({ title: '', description: '', order_id: '', assigned_to: '', due_at: '' })

  const load = React.useCallback(async () => {
    try {
      const [tasksRes, managersRes] = await Promise.all([
        crmManagerApi.getTasks({ limit: 50 }),
        crmManagerApi.getManagers()
      ])
      if (tasksRes?.success) {
        const nextTasks = (tasksRes.tasks || []).map((task: Task) => normalizeTask(task)).filter((task: Task) => Boolean(task.id))
        setTasks(nextTasks)
      }
      if (managersRes?.success) setManagers(managersRes.managers || [])
    } catch (e) {
      console.error('Tasks load error', e)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return

    const payload: {
      title: string
      description: string | null
      order_id: string | null
      assigned_to: string | null
      due_at: string | null
    } = {
      title: form.title,
      description: form.description || null,
      order_id: form.order_id || null,
      assigned_to: form.assigned_to || null,
      due_at: form.due_at || null
    }

    const res = await crmManagerApi.createTask(payload)
    if (res?.success) {
      setForm({ title: '', description: '', order_id: '', assigned_to: '', due_at: '' })
      load()
    }
  }

  const toggleComplete = async (task: Task) => {
    if (!task.id) return
    const isCompleted = Boolean(task.completed)
    const res = await crmManagerApi.updateTask(task.id, { completed: isCompleted ? 0 : 1 })
    if (res?.success) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: isCompleted ? 0 : 1 } : t)))
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!taskId) {
      await load()
      return
    }
    if (!window.confirm('Удалить эту задачу?')) return
    const res = await crmManagerApi.deleteTask(taskId)
    if (res?.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    } else {
      await load()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-400">Задачи</div>
        <div className="text-lg font-semibold text-[#18181b]">Командные задачи</div>
        <form onSubmit={createTask} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Название задачи"
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
            required
          />
          <input
            value={form.order_id}
            onChange={(e) => setForm({ ...form, order_id: e.target.value })}
            placeholder="ID заказа"
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
          <select
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          >
            <option value="">Назначить менеджера</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
          <input
            type="date"
            value={form.due_at}
            onChange={(e) => setForm({ ...form, due_at: e.target.value })}
            className="h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
          <button type="submit" className="h-12 rounded-lg bg-[#18181b] text-white text-sm">Создать</button>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Комментарий"
            className="md:col-span-5 h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-3 text-sm"
          />
        </form>
      </div>

      <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f4f4f5] text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-left">Задача</th>
              <th className="px-4 py-3 text-left">Срок</th>
              <th className="px-4 py-3 text-left">Исполнитель</th>
              <th className="px-4 py-3 text-left w-20">Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-[#e4e4e7]">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleComplete(task)}
                    className={`rounded-full px-3 py-1 text-xs ${task.completed ? 'bg-[#18181b] text-white' : 'bg-[#f4f4f5] text-[#18181b]'}`}
                  >
                    {task.completed ? 'Готово' : 'В работе'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[#18181b]">{task.title}</div>
                  {task.description && <div className="text-xs text-slate-500">{task.description}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500">{task.due_at ? new Date(task.due_at).toLocaleDateString('ru-RU') : '--'}</td>
                <td className="px-4 py-3 text-slate-500">{managers.find((m) => m.id === task.assigned_to)?.name || '--'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="Удалить задачу"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Задач пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
