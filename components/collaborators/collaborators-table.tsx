'use client'

import type { Role } from '@/types'
import type { CollaboratorRow } from '@/app/(app)/collaborators/page'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  RemoveMemberButton,
  RevokeInvitationButton,
  ResendInvitationButton,
} from '@/components/collaborators/collaborator-actions'

const ROLE_LABELS: Record<Role, string> = {
  principal:   'Principal',
  teacher:     'Teacher',
  student_rep: 'Student Rep',
}

function RoleBadge({ role }: { role: Role }) {
  if (role === 'principal') {
    return <Badge className="bg-success/10 text-success">Principal</Badge>
  }
  if (role === 'teacher') {
    return <Badge className="bg-muted text-muted-foreground">Teacher</Badge>
  }
  return (
    <Badge
      variant="outline"
      className="border-primary/40 bg-transparent text-primary"
    >
      {ROLE_LABELS[role]}
    </Badge>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return <Badge className="bg-muted text-muted-foreground">Active</Badge>
  }
  return <Badge className="bg-warning/10 text-warning">Pending</Badge>
}

function initials(fullName: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return email.charAt(0).toUpperCase()
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

type CollaboratorsTableProps = {
  rows: CollaboratorRow[]
  currentUserId: string
  isPrincipal: boolean
}

export function CollaboratorsTable({
  rows,
  currentUserId,
  isPrincipal,
}: CollaboratorsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          if (row.type === 'member') {
            const canRemove =
              isPrincipal &&
              row.role !== 'principal' &&
              row.user_id !== currentUserId

            return (
              <TableRow key={`member-${row.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {initials(row.full_name, row.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{row.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={row.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge active />
                </TableCell>
                <TableCell className="text-right">
                  {canRemove && (
                    <RemoveMemberButton
                      userId={row.user_id}
                      memberName={row.full_name}
                    />
                  )}
                </TableCell>
              </TableRow>
            )
          }

          // Pending invitation row
          return (
            <TableRow key={`invite-${row.id}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {row.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">—</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.email}
              </TableCell>
              <TableCell>
                <RoleBadge role={row.role} />
              </TableCell>
              <TableCell>
                <StatusBadge active={false} />
              </TableCell>
              <TableCell className="text-right">
                {isPrincipal && (
                  <div className="flex items-center justify-end gap-1">
                    <ResendInvitationButton email={row.email} role={row.role} />
                    <RevokeInvitationButton
                      invitationId={row.id}
                      email={row.email}
                    />
                  </div>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
