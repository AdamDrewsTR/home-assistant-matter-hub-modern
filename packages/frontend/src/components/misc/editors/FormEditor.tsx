import { withTheme } from "@rjsf/core";
import { Theme } from "@rjsf/mui";
import type {
  CustomValidator,
  FormValidation,
  RegistryFieldsType,
  RJSFValidationError,
  TemplatesType,
  UiSchema,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type { JSONSchema7 } from "json-schema";
import { useCallback, useEffect, useRef } from "react";
import type { ValidationError } from "./validation-error.ts";

const Form = withTheme(Theme);

export interface FormEditorProps {
  schema: JSONSchema7;
  uiSchema?: UiSchema;
  value: object;
  onChange: (
    value: object,
    isValid: boolean,
    initialDefaults?: boolean,
  ) => void;
  customValidate?: (value: object | undefined) => ValidationError[];
  templates?: Partial<TemplatesType>;
  fields?: RegistryFieldsType;
}

export const FormEditor = (props: FormEditorProps) => {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const onChange = (data: object, _errors: RJSFValidationError[]) => {
    // Only gate save on custom validation errors (e.g. port conflicts).
    // RJSF's schema errors may include false positives introduced by its
    // internal default-state processing; inline error hints still render.
    const customErrors = props.customValidate?.(data) ?? [];
    // RJSF emits schema defaults from its constructor, before any user edit.
    props.onChange(data, customErrors.length === 0, !mounted.current);
  };

  const customValidate = props.customValidate;
  const customValidator: CustomValidator = useCallback(
    (formData, errors) => {
      const validationErrors = customValidate?.(formData) ?? [];
      validationErrors.forEach((error) => {
        if (!error.message) {
          return;
        }
        const path = error.instancePath.split("/");
        let nestedError: FormValidation = errors;
        for (const part of path) {
          if (part === "") continue;
          nestedError = nestedError[part] ?? nestedError;
        }
        nestedError.addError(error.message!);
      });
      return errors;
    },
    [customValidate],
  );

  return (
    <Form
      schema={props.schema}
      uiSchema={props.uiSchema}
      validator={validator}
      formData={props.value}
      liveValidate="onChange"
      customValidate={customValidator}
      showErrorList={false}
      onChange={(data) => onChange(data.formData, data.errors)}
      templates={props.templates}
      fields={props.fields}
    />
  );
};
