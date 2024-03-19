import faunadb from "faunadb";
import fs from "fs";
const q = faunadb.query;

let client = new faunadb.Client({
  secret: "fnAFVnqDsmAAze1MxTl8rNVNEtXnxoN9cZGCmc71",
});

let counter = 0;
const importFile = async (file: string) => {
  const data = fs.readFileSync(file, "utf8");
  const tasks = JSON.parse(data);

  for (const task of tasks) {
    const createP = await client.query(
      q.Create(q.Collection("Task"), {
        data: {
          taskNumber: counter,
          title: task.name,
          description: task.notes,
          assignee: task?.assignee?.name,
          project: task.projects[0].name,
        },
      })
    );
    counter++;
    console.log(createP);
  }
};

(async () => {
  const files = fs.readdirSync("data");
  for (const file of files) {
    if (file.endsWith(".json")) {
      console.log("import file", file);
      await importFile("data/" + file);
    }
  }
  console.log("all done");
})();
