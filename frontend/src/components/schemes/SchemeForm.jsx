import { Modal, Form } from '../common/CommonUI'

export default function SchemeForm({ scheme, onClose, onSubmit }) {
  return (
    <Modal title={scheme.scheme_id ? 'Edit government scheme' : 'Create government scheme'} onClose={onClose}>
      <Form onSubmit={onSubmit} submit="Save scheme">
        <label>
          Name
          <input name="name" defaultValue={scheme.name || ''} required />
        </label>
        <label>
          Description
          <textarea name="description" defaultValue={scheme.description || ''} required />
        </label>
        <label>
          Government level
          <input name="government_level" defaultValue={scheme.government_level || ''} />
        </label>
        <label>
          Benefit description
          <textarea name="benefit_description" defaultValue={scheme.benefit_description || ''} />
        </label>
        <label>
          Eligibility
          <textarea name="eligibility" defaultValue={scheme.eligibility || ''} />
        </label>
        <label>
          Application information
          <textarea name="application_information" defaultValue={scheme.application_information || ''} />
        </label>
        <label>
          Official link
          <input name="external_link" type="url" defaultValue={scheme.external_link || ''} />
        </label>
      </Form>
    </Modal>
  )
}
