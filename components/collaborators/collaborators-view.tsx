'use client'

import { useEffect, useMemo, useState } from 'react'
import { RiSearchLine, RiTeamLine, RiUserAddLine } from '@remixicon/react'
import type { ActiveMember, CollaboratorRow, PendingInvite } from '@/app/(app)/collaborators/page'
import { useHeader } from '@/components/shared/header-context'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CollaboratorsTable } from '@/components/collaborators/collaborators-table'
import { AddCollaboratorDialog } from '@/components/collaborators/add-collaborator-dialog'

type CollaboratorsViewProps = {
  members: ActiveMember[]
  pending: PendingInvite[]
  currentUserId: string
  isPrincipal: boolean
}

export function CollaboratorsView({
  members,
  pending,
  currentUserId,
  isPrincipal,
}: CollaboratorsViewProps) {
  const { setContent } = useHeader()
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setContent({
      title: 'Collaborators',
      description: 'People with access to your school',
      cta: isPrincipal ? (
        <Button onClick={() => setAddOpen(true)}>
          <RiUserAddLine className="size-4" />
          Invite collaborator
        </Button>
      ) : undefined,
    })
    return () => setContent({ title: '' })
  }, [setContent, isPrincipal])

  const allRows: CollaboratorRow[] = useMemo(
    () => [...members, ...pending],
    [members, pending]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return allRows
    return allRows.filter((row) => {
      if (row.type === 'member') {
        return (
          row.full_name.toLowerCase().includes(query) ||
          row.email.toLowerCase().includes(query)
        )
      }
      return row.email.toLowerCase().includes(query)
    })
  }, [allRows, search])

  const isEmpty = allRows.length === 0

  return (
    <>
      {isEmpty ? (
        <Card className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<RiTeamLine />}
            title="No collaborators yet"
            description="Invite team members to manage who has access to your school."
            action={
              isPrincipal ? (
                <Button onClick={() => setAddOpen(true)}>
                  <RiUserAddLine className="size-4" />
                  Invite collaborator
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or email"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<RiSearchLine />}
                title="No matches"
                description={`No collaborators match "${search.trim()}".`}
              />
            ) : (
              <CollaboratorsTable
                rows={filtered}
                currentUserId={currentUserId}
                isPrincipal={isPrincipal}
              />
            )}
          </CardContent>
        </Card>
      )}

      {isPrincipal && (
        <AddCollaboratorDialog open={addOpen} onOpenChange={setAddOpen} />
      )}
    </>
  )
}
