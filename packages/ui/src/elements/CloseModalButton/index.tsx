import { useModal } from '@faceless-ui/modal'

import { XIcon } from '../../icons/X/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import './index.scss'

const baseClass = 'close-modal-button'

export function CloseModalButton({
  slug,
  className,
  disabled,
}: {
  className?: string
  disabled?: boolean
  slug: string
}) {
  const { closeModal } = useModal()
  const { t } = useTranslation()

  return (
    <button
      aria-label={t('general:close')}
      className={[baseClass, className].filter(Boolean).join(' ')}
      disabled={disabled}
      key="close-button"
      onClick={() => {
        closeModal(slug)
      }}
      tabIndex={-1}
      type="button"
    >
      <XIcon />
    </button>
  )
}
