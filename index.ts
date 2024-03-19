import { marked } from "marked";
import { promiseMap } from "./utils";
const { pipeline } = require("stream/promises");

const Asana = require("asana");
const fs = require("fs");
const { mkdirp } = require("mkdirp");

let client = Asana.ApiClient.instance;
let token = client.authentications["token"];
token.accessToken = "0/145dd6f39a345cb536557388ced5a7b0";

const tasksApiInstance = new Asana.TasksApi();
const workspaceApiInstance = new Asana.WorkspacesApi();
const projectsApiInstance = new Asana.ProjectsApi();
const attachmentsApiInstance = new Asana.AttachmentsApi();

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

const downloadFile = async (path: string, url: string) => {
  const fileWriteStream = fs.createWriteStream(path, {
    autoClose: true,
    flags: "w",
  });

  const res = await fetch(url);
  await pipeline(res.body, fileWriteStream);
};

export const exportTask = async (
  tasksFolder: string,
  project: { name: string; gid: string },
  task: { name: string; gid: string; html_notes: string }
) => {
  const attachments = await attachmentsApiInstance.getAttachmentsForObject(
    task.gid,
    {
      opt_fields:
        "connected_to_app,created_at,download_url,host,name,offset,parent,parent.created_by,parent.name,parent.resource_subtype,path,permanent_url,resource_subtype,size,uri,view_url",
    }
  );

  console.log("fetched task attachments: ", attachments.data.length);

  const taskSlug = `${slugify(task.name)}-${task.gid}}`;
  const taskPath = `${tasksFolder}${taskSlug}/`;
  const attachmentsPath = `${taskPath}attachments/`;
  mkdirp.sync(attachmentsPath);
  const downloadedAttachments = await promiseMap(
    attachments.data,
    async (attachment) => {
      const url = attachment.download_url;
      if (url) {
        const attachmentPath = `${attachmentsPath}${attachment.gid}-${attachment.name}`;
        await downloadFile(attachmentPath, url);
        console.log("downloaded attachment", attachmentPath);
        return attachmentPath;
      } else if (attachment.host === "external") {
        console.log("external attachment", attachment.name);
        return attachment.name;
      }
    },
    { concurrency: 5 }
  );

  const taskJson = {
    task,
    downloadedAttachments: downloadedAttachments,
    attachments: attachments.data,
  };

  mkdirp.sync(taskPath);
  fs.writeFileSync(
    `${taskPath}/${taskSlug}.json`,
    JSON.stringify(task, null, 4)
  );
  fs.writeFileSync(
    `${taskPath}/${taskSlug}.html`,
    `<html>
      <head>
        <style>
          *{
            font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
          }
          main{
            max-width:60rem;
            margin:0 auto;
          }
        </style>
        <title>${task.name}</title>
      </head>
      <body>
      <main>
        <h1>${task.name}</h1>
        <p>Project: ${project.name}</p>
       <div>${task.html_notes}</div>
        <pre>${JSON.stringify(taskJson, null, 4)}</pre>
      </main
      </body>
    </html>`
  );
};

(async () => {
  const workspace = "423717206019475";
  const res = await projectsApiInstance.getProjects({
    workspace,
  });

  const projects = res.data.slice(0);

  console.log(projects);
  let i = 0;
  for (const project of projects) {
    console.log(project);
    const tasks = await tasksApiInstance.getTasks({
      project: project.gid,
      opt_fields:
        "actual_time_minutes,approval_status,assignee,assignee.name,assignee_section,assignee_section.name,assignee_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by,custom_fields,custom_fields.asana_created_field,custom_fields.created_by,custom_fields.created_by.name,custom_fields.currency_code,custom_fields.custom_label,custom_fields.custom_label_position,custom_fields.date_value,custom_fields.date_value.date,custom_fields.date_value.date_time,custom_fields.description,custom_fields.display_value,custom_fields.enabled,custom_fields.enum_options,custom_fields.enum_options.color,custom_fields.enum_options.enabled,custom_fields.enum_options.name,custom_fields.enum_value,custom_fields.enum_value.color,custom_fields.enum_value.enabled,custom_fields.enum_value.name,custom_fields.format,custom_fields.has_notifications_enabled,custom_fields.is_formula_field,custom_fields.is_global_to_workspace,custom_fields.is_value_read_only,custom_fields.multi_enum_values,custom_fields.multi_enum_values.color,custom_fields.multi_enum_values.enabled,custom_fields.multi_enum_values.name,custom_fields.name,custom_fields.number_value,custom_fields.people_value,custom_fields.people_value.name,custom_fields.precision,custom_fields.resource_subtype,custom_fields.text_value,custom_fields.type,dependencies,dependents,due_at,due_on,external,external.data,followers,followers.name,hearted,hearts,hearts.user,hearts.user.name,html_notes,is_rendered_as_separator,liked,likes,likes.user,likes.user.name,memberships,memberships.project,memberships.project.name,memberships.section,memberships.section.name,modified_at,name,notes,num_hearts,num_likes,num_subtasks,offset,parent,parent.created_by,parent.name,parent.resource_subtype,path,permalink_url,projects,projects.name,resource_subtype,start_at,start_on,tags,tags.name,uri,workspace,workspace.name",
    });
    console.log("fetched tasks: ", tasks.data.length);
    const attachments = await attachmentsApiInstance.getAttachmentsForObject(
      project.gid,
      {
        opt_fields:
          "connected_to_app,created_at,download_url,host,name,offset,parent,parent.created_by,parent.name,parent.resource_subtype,path,permanent_url,resource_subtype,size,uri,view_url",
      }
    );

    console.log("fetched attachments: ", attachments.data.length);

    const projectFolder = `data/${slugify(project.name)}-${project.gid}/`;
    mkdirp.sync(projectFolder);
    fs.writeFileSync(
      `${projectFolder}tasks.json`,
      JSON.stringify(tasks.data, null, 4)
    );
    const tasksFolder = `${projectFolder}tasks/`;
    mkdirp.sync(tasksFolder);

    await promiseMap(
      tasks.data,
      async (attachment) => {
        return exportTask(tasksFolder, project, attachment);
      },
      { concurrency: 5 }
    );
    console.log("project completed", i);
    i++;
  }
})();
